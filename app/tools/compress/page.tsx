"use client"
import { useCallback, useRef, useState } from "react"
import AppShell from "@/components/vrittih/AppShell"
import { IconUpload, IconArrowRight, IconX, IconCheckCircle } from "@/components/ui/Icons"

type Item = { id: string; name: string; origSize: number; outSize: number; url: string; outName: string; w: number; h: number; ow: number; oh: number }
const kb = (b: number) => b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(2)} MB`

// Real in-browser compression: decode → (optionally) downscale → re-encode via Canvas.
async function compressOne(file: File, opts: { format: string; quality: number; maxDim: number }): Promise<Item> {
  const bmp = await createImageBitmap(file)
  const ow = bmp.width, oh = bmp.height
  let w = ow, h = oh
  if (opts.maxDim && Math.max(w, h) > opts.maxDim) { const s = opts.maxDim / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s) }
  const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h
  const ctx = canvas.getContext("2d")!; ctx.imageSmoothingQuality = "high"; ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close?.()
  const type = opts.format
  const blob: Blob = await new Promise((res) => canvas.toBlob(b => res(b!), type, type === "image/png" ? undefined : opts.quality))
  const ext = type === "image/webp" ? "webp" : type === "image/png" ? "png" : "jpg"
  const base = file.name.replace(/\.[^.]+$/, "")
  return { id: Math.random().toString(36).slice(2), name: file.name, origSize: file.size, outSize: blob.size, url: URL.createObjectURL(blob), outName: `${base}-vrittih.${ext}`, w, h, ow, oh }
}

export default function CompressTool() {
  const [items, setItems] = useState<Item[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [format, setFormat] = useState("image/webp")
  const [quality, setQuality] = useState(0.8)
  const [maxDim, setMaxDim] = useState(0)
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const run = useCallback(async (fs: File[], f = format, q = quality, m = maxDim) => {
    if (!fs.length) return
    setBusy(true)
    const out: Item[] = []
    for (const file of fs) { try { out.push(await compressOne(file, { format: f, quality: q, maxDim: m })) } catch { /* skip unreadable */ } }
    setItems(out); setBusy(false)
  }, [format, quality, maxDim])

  function onPick(list: FileList | null) {
    const fs = Array.from(list || []).filter(f => f.type.startsWith("image/"))
    if (!fs.length) return
    setFiles(fs); run(fs)
  }
  const reRun = (f = format, q = quality, m = maxDim) => { setFormat(f); setQuality(q); setMaxDim(m); if (files.length) run(files, f, q, m) }

  const totalOrig = items.reduce((a, i) => a + i.origSize, 0)
  const totalOut = items.reduce((a, i) => a + i.outSize, 0)
  const saved = totalOrig ? Math.round((1 - totalOut / totalOrig) * 100) : 0

  return (
    <AppShell title="Compress images">
      <style>{CSS}</style>
      <div className="cm">
        <header className="cmHead">
          <div>
            <h1 className="cmTitle">Image compressor</h1>
            <p className="cmSub">Real, in-browser compression — your files never leave your device. Shrink photos and assets to a fraction of their size with no visible loss.</p>
          </div>
        </header>

        <div className={"cmDrop" + (drag ? " on" : "")}
          onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); onPick(e.dataTransfer.files) }}
          onClick={() => inputRef.current?.click()}>
          <span className="cmDropIc"><IconUpload size={26} /></span>
          <div className="cmDropTitle">Drop images here, or click to choose</div>
          <div className="cmDropSub">JPEG, PNG, WebP · batch supported · processed locally</div>
          <input ref={inputRef} type="file" accept="image/*" multiple onChange={e => onPick(e.target.files)} style={{ display: "none" }} />
        </div>

        {(items.length > 0 || busy) && (
          <>
            <div className="cmControls">
              <label className="cmCtl">Format
                <select value={format} onChange={e => reRun(e.target.value)} className="cmInput">
                  <option value="image/webp">WebP (best)</option>
                  <option value="image/jpeg">JPEG</option>
                  <option value="image/png">PNG (lossless)</option>
                </select>
              </label>
              <label className="cmCtl" style={{ flex: 1, minWidth: 200 }}>Quality {Math.round(quality * 100)}%
                <input type="range" min={0.3} max={0.95} step={0.05} value={quality} disabled={format === "image/png"}
                  onChange={e => setQuality(+e.target.value)} onMouseUp={() => reRun()} onTouchEnd={() => reRun()} className="cmRange" />
              </label>
              <label className="cmCtl">Max size
                <select value={maxDim} onChange={e => reRun(format, quality, +e.target.value)} className="cmInput">
                  <option value={0}>Original</option><option value={2560}>2560px</option><option value={1920}>1920px</option><option value={1280}>1280px</option><option value={800}>800px</option>
                </select>
              </label>
            </div>

            {items.length > 0 && (
              <div className="cmSummary">
                <div><b>{kb(totalOrig)}</b> → <b style={{ color: "var(--brand-700)" }}>{kb(totalOut)}</b></div>
                <div className="cmSaved"><IconCheckCircle size={15} /> {saved}% smaller · {items.length} file{items.length > 1 ? "s" : ""}</div>
                <button className="cmDownAll" onClick={() => items.forEach(i => { const a = document.createElement("a"); a.href = i.url; a.download = i.outName; a.click() })}>Download all</button>
              </div>
            )}

            <div className="cmList">
              {busy && items.length === 0 && [0, 1].map(i => <div key={i} className="v-skeleton" style={{ height: 72, borderRadius: 12 }} />)}
              {items.map(it => {
                const pct = Math.round((1 - it.outSize / it.origSize) * 100)
                return (
                  <div key={it.id} className="cmRow">
                    <img src={it.url} alt="" className="cmThumb" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="cmName">{it.name}</div>
                      <div className="cmMeta">{it.ow}×{it.oh}{it.w !== it.ow ? ` → ${it.w}×${it.h}` : ""} · {kb(it.origSize)} → <b style={{ color: "var(--brand-700)" }}>{kb(it.outSize)}</b></div>
                      <div className="cmBar"><div className="cmBarF" style={{ width: `${Math.max(4, 100 - pct)}%` }} /></div>
                    </div>
                    <div className="cmPct">{pct > 0 ? `−${pct}%` : "0%"}</div>
                    <a href={it.url} download={it.outName} className="cmDown">Download <IconArrowRight size={13} /></a>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}

const CSS = `
.cm{ max-width:840px; margin:0 auto; padding:clamp(1.25rem,3vw,2rem); }
.cmHead{ margin-bottom:20px; }
.cmTitle{ font-family:var(--font-display); font-size:clamp(1.5rem,3vw,2rem); font-weight:600; color:var(--v-ink); letter-spacing:-.02em; }
.cmSub{ font-size:14px; color:var(--v-ink-2); margin-top:5px; max-width:60ch; line-height:1.55; }
.cmDrop{ border:2px dashed var(--v-line-2); border-radius:16px; padding:2.5rem 1rem; text-align:center; cursor:pointer; transition:border-color .15s, background .15s; background:var(--v-surface); }
.cmDrop:hover,.cmDrop.on{ border-color:var(--brand-500,#0F6E56); background:var(--brand-100); }
.cmDropIc{ display:grid; place-items:center; width:56px; height:56px; border-radius:15px; background:var(--brand-100); color:var(--brand-600); margin:0 auto 12px; }
.cmDropTitle{ font-size:15.5px; font-weight:650; color:var(--v-ink); }
.cmDropSub{ font-size:12.5px; color:var(--v-ink-3); margin-top:4px; }
.cmControls{ display:flex; flex-wrap:wrap; gap:16px; align-items:flex-end; margin:18px 0; padding:14px 16px; background:var(--v-surface); border:1px solid var(--v-line); border-radius:14px; }
.cmCtl{ display:flex; flex-direction:column; gap:6px; font-size:12px; font-weight:600; color:var(--v-ink-2); }
.cmInput{ border:1px solid var(--v-line-2); border-radius:9px; padding:8px 10px; font-size:13px; background:var(--v-surface); color:var(--v-ink); font-family:inherit; }
.cmRange{ accent-color:var(--brand-600); }
.cmSummary{ display:flex; align-items:center; gap:16px; flex-wrap:wrap; padding:12px 16px; background:var(--brand-100); border-radius:12px; margin-bottom:14px; font-size:14px; color:var(--v-ink); }
.cmSaved{ display:inline-flex; align-items:center; gap:6px; font-weight:700; color:var(--brand-700); }
.cmDownAll{ margin-left:auto; background:var(--brand-600); color:#fff; border:none; border-radius:9px; padding:8px 16px; font-size:13px; font-weight:600; cursor:pointer; }
.cmList{ display:flex; flex-direction:column; gap:10px; }
.cmRow{ display:flex; align-items:center; gap:14px; background:var(--v-surface); border:1px solid var(--v-line); border-radius:12px; padding:10px 12px; box-shadow:var(--v-shadow-sm); }
.cmThumb{ width:52px; height:52px; border-radius:9px; object-fit:cover; flex-shrink:0; background:var(--v-surface-2); }
.cmName{ font-size:13.5px; font-weight:600; color:var(--v-ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cmMeta{ font-size:12px; color:var(--v-ink-3); margin:2px 0 6px; }
.cmBar{ height:6px; background:var(--v-surface-2); border-radius:4px; overflow:hidden; }
.cmBarF{ height:6px; background:var(--brand-500,#0F6E56); border-radius:4px; }
.cmPct{ font-family:var(--font-mono); font-size:13px; font-weight:700; color:var(--brand-700); flex-shrink:0; }
.cmDown{ display:inline-flex; align-items:center; gap:5px; background:var(--v-surface); border:1px solid var(--v-line-2); color:var(--v-ink); border-radius:9px; padding:8px 12px; font-size:12.5px; font-weight:600; text-decoration:none; flex-shrink:0; }
.cmDown:hover{ border-color:var(--brand-500,#0F6E56); color:var(--brand-700); }
@media (max-width:560px){ .cmRow{ flex-wrap:wrap; } .cmDown{ width:100%; justify-content:center; } }
`
