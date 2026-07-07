"use client"
import { useState } from "react"
import AppShell from "@/components/vrittih/AppShell"
import { IconSearch, IconCheckCircle, IconFileText } from "@/components/ui/Icons"

type Author = { family: string; given: string }
type Ref = { type: string; authors: Author[]; title: string; source: string; year: string; volume: string; issue: string; pages: string; publisher: string; url: string; doi: string }
const EMPTY: Ref = { type: "article", authors: [], title: "", source: "", year: "", volume: "", issue: "", pages: "", publisher: "", url: "", doi: "" }

const inits = (g: string) => g.split(/\s+/).filter(Boolean).map(w => w[0].toUpperCase() + ".").join(" ")
const parseAuthors = (s: string): Author[] => s.split(/;|\n/).map(x => x.trim()).filter(Boolean).map(x => {
  if (x.includes(",")) { const [family, given] = x.split(","); return { family: family.trim(), given: (given || "").trim() } }
  const parts = x.split(/\s+/); return { family: parts.pop() || "", given: parts.join(" ") }
})

function fmtAPA(r: Ref) {
  const a = r.authors.map(x => `${x.family}, ${inits(x.given)}`)
  const auth = a.length === 0 ? "" : a.length === 1 ? a[0] : a.slice(0, -1).join(", ") + ", & " + a.slice(-1)
  let s = `${auth}${auth ? " " : ""}(${r.year || "n.d."}). ${r.title}.`
  if (r.source) s += ` *${r.source}*${r.volume ? `, ${r.volume}` : ""}${r.issue ? `(${r.issue})` : ""}${r.pages ? `, ${r.pages}` : ""}.`
  else if (r.publisher) s += ` ${r.publisher}.`
  if (r.doi) s += ` https://doi.org/${r.doi}`
  else if (r.url) s += ` ${r.url}`
  return s.replace(/\*/g, "")
}
function fmtMLA(r: Ref) {
  const a = r.authors
  const auth = a.length === 0 ? "" : a.length === 1 ? `${a[0].family}, ${a[0].given}` : `${a[0].family}, ${a[0].given}, et al`
  let s = `${auth}${auth ? ". " : ""}"${r.title}." ${r.source || r.publisher}`
  if (r.volume) s += `, vol. ${r.volume}`
  if (r.issue) s += `, no. ${r.issue}`
  if (r.year) s += `, ${r.year}`
  if (r.pages) s += `, pp. ${r.pages}`
  s += "."
  if (r.doi) s += ` https://doi.org/${r.doi}.`
  return s
}
function fmtIEEE(r: Ref) {
  const a = r.authors.map(x => `${inits(x.given)} ${x.family}`)
  const auth = a.length <= 2 ? a.join(" and ") : a[0] + " et al."
  return `${auth}, "${r.title}," *${r.source || r.publisher}*${r.volume ? `, vol. ${r.volume}` : ""}${r.issue ? `, no. ${r.issue}` : ""}${r.pages ? `, pp. ${r.pages}` : ""}${r.year ? `, ${r.year}` : ""}.`.replace(/\*/g, "")
}
function fmtBib(r: Ref) {
  const key = (r.authors[0]?.family || "ref").toLowerCase().replace(/\W/g, "") + (r.year || "")
  const auth = r.authors.map(x => `${x.family}, ${x.given}`).join(" and ")
  return `@${r.type}{${key},
  author  = {${auth}},
  title   = {${r.title}},
  ${r.source ? `journal = {${r.source}},` : r.publisher ? `publisher = {${r.publisher}},` : ""}
  year    = {${r.year}},${r.volume ? `\n  volume  = {${r.volume}},` : ""}${r.issue ? `\n  number  = {${r.issue}},` : ""}${r.pages ? `\n  pages   = {${r.pages}},` : ""}${r.doi ? `\n  doi     = {${r.doi}},` : ""}${r.url ? `\n  url     = {${r.url}},` : ""}
}`.replace(/\n\s*\n/g, "\n")
}
const STYLES: [string, (r: Ref) => string][] = [["APA", fmtAPA], ["MLA", fmtMLA], ["IEEE", fmtIEEE], ["BibTeX", fmtBib]]

export default function CitationTool() {
  const [r, setR] = useState<Ref>(EMPTY)
  const [authorsText, setAuthorsText] = useState("")
  const [doi, setDoi] = useState("")
  const [style, setStyle] = useState("APA")
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState("")
  const [copied, setCopied] = useState(false)

  const set = (k: keyof Ref, v: string) => setR(p => ({ ...p, [k]: v }))
  const ref = { ...r, authors: parseAuthors(authorsText) }
  const output = STYLES.find(s => s[0] === style)![1](ref)

  async function fetchDoi() {
    const d = doi.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//, "")
    if (!d) return
    setLoading(true); setMsg("")
    try {
      const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(d)}`)
      if (!res.ok) throw new Error("not found")
      const m = (await res.json()).message
      const authors: Author[] = (m.author || []).map((a: any) => ({ family: a.family || "", given: a.given || "" }))
      setAuthorsText(authors.map(a => `${a.family}, ${a.given}`).join("; "))
      setR({
        type: "article", title: (m.title || [""])[0], source: (m["container-title"] || [""])[0] || "",
        year: String(m.issued?.["date-parts"]?.[0]?.[0] || m.published?.["date-parts"]?.[0]?.[0] || ""),
        volume: m.volume || "", issue: m.issue || "", pages: m.page || "", publisher: m.publisher || "",
        url: m.URL || "", doi: m.DOI || d, authors,
      })
      setMsg("Fetched from CrossRef ✓")
    } catch { setMsg("Couldn't find that DOI — enter details manually below.") }
    setLoading(false)
  }

  const fg = (label: string, k: Exclude<keyof Ref, "authors">, ph = "", w = "") =>
    <label className="ctFg" style={{ flex: w === "half" ? "1 1 160px" : "1 1 100%" }}><span>{label}</span>
      <input value={r[k]} onChange={e => set(k, e.target.value)} placeholder={ph} className="ctInput" /></label>

  return (
    <AppShell title="Citation helper">
      <style>{CSS}</style>
      <div className="ct">
        <header className="ctHead">
          <h1 className="ctTitle">Citation &amp; reference helper</h1>
          <p className="ctSub">Paste a DOI to auto-fill from CrossRef, or enter details by hand. Get a clean citation in APA, MLA, IEEE or BibTeX.</p>
        </header>

        <div className="ctDoi">
          <IconSearch size={15} />
          <input value={doi} onChange={e => setDoi(e.target.value)} placeholder="Paste a DOI (e.g. 10.1038/nphys1170) and auto-fill…" onKeyDown={e => e.key === "Enter" && fetchDoi()} />
          <button onClick={fetchDoi} disabled={loading} className="ctDoiBtn">{loading ? "Fetching…" : "Fetch"}</button>
        </div>
        {msg && <div className="ctMsg">{msg}</div>}

        <div className="ctForm">
          <label className="ctFg" style={{ flex: "1 1 100%" }}><span>Authors <em>(one per line, or "Family, Given; …")</em></span>
            <textarea value={authorsText} onChange={e => setAuthorsText(e.target.value)} rows={2} placeholder={"Doe, John\nSmith, Jane"} className="ctInput" /></label>
          {fg("Title", "title", "Paper or article title")}
          <div className="ctFlex">{fg("Journal / source", "source", "e.g. Nature Physics", "half")}{fg("Year", "year", "2024", "half")}</div>
          <div className="ctFlex">{fg("Volume", "volume", "", "half")}{fg("Issue", "issue", "", "half")}{fg("Pages", "pages", "101–110", "half")}</div>
          <div className="ctFlex">{fg("DOI", "doi", "", "half")}{fg("URL", "url", "", "half")}</div>
        </div>

        <div className="ctOut">
          <div className="ctTabs">{STYLES.map(([s]) => <button key={s} className={"ctTab" + (style === s ? " on" : "")} onClick={() => setStyle(s)}>{s}</button>)}</div>
          <pre className="ctResult">{ref.title ? output : "Fill in a title (and authors) to generate your citation."}</pre>
          <button className="ctCopy" disabled={!ref.title} onClick={() => { navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>
            {copied ? <><IconCheckCircle size={14} /> Copied</> : <><IconFileText size={14} /> Copy citation</>}
          </button>
        </div>
      </div>
    </AppShell>
  )
}

const CSS = `
.ct{ max-width:760px; margin:0 auto; padding:clamp(1.25rem,3vw,2rem); }
.ctHead{ margin-bottom:18px; }
.ctTitle{ font-family:var(--font-display); font-size:clamp(1.6rem,3vw,2.1rem); font-weight:600; color:var(--v-ink); letter-spacing:-.02em; }
.ctSub{ font-size:14.5px; color:var(--v-ink-2); margin-top:5px; line-height:1.55; }
.ctDoi{ display:flex; align-items:center; gap:10px; background:var(--v-surface); border:1px solid var(--v-line-2); border-radius:12px; padding:0 8px 0 14px; color:var(--v-ink-3); }
.ctDoi input{ border:none; outline:none; padding:12px 0; font-size:14px; flex:1; background:none; color:var(--v-ink); }
.ctDoiBtn{ background:var(--brand-600); color:#fff; border:none; border-radius:9px; padding:8px 16px; font-size:13px; font-weight:600; cursor:pointer; }
.ctMsg{ font-size:12.5px; color:var(--v-ink-2); margin-top:8px; }
.ctForm{ display:flex; flex-direction:column; gap:12px; margin:18px 0; }
.ctFlex{ display:flex; flex-wrap:wrap; gap:12px; }
.ctFg{ display:flex; flex-direction:column; gap:5px; }
.ctFg span{ font-size:12px; font-weight:600; color:var(--v-ink-2); }
.ctFg em{ font-weight:400; color:var(--v-ink-3); font-style:normal; }
.ctInput{ border:1px solid var(--v-line-2); border-radius:10px; padding:10px 12px; font-size:13.5px; outline:none; background:var(--v-surface); color:var(--v-ink); font-family:inherit; width:100%; }
.ctInput:focus{ border-color:var(--brand-400,#1D9E75); }
.ctOut{ background:var(--v-surface); border:1px solid var(--v-line); border-radius:14px; padding:14px; }
.ctTabs{ display:flex; gap:6px; margin-bottom:12px; }
.ctTab{ background:var(--v-surface-2); border:none; border-radius:8px; padding:7px 14px; font-size:13px; font-weight:600; color:var(--v-ink-2); cursor:pointer; }
.ctTab.on{ background:var(--brand-900); color:#fff; }
.ctResult{ background:var(--v-surface-2); border-radius:10px; padding:14px; font-size:13.5px; line-height:1.6; color:var(--v-ink); white-space:pre-wrap; word-break:break-word; font-family:var(--font-mono); margin:0; }
.ctCopy{ display:inline-flex; align-items:center; gap:7px; margin-top:12px; background:var(--brand-600); color:#fff; border:none; border-radius:10px; padding:9px 16px; font-size:13px; font-weight:600; cursor:pointer; }
.ctCopy:disabled{ opacity:.5; cursor:default; }
`
