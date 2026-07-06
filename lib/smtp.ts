/**
 * Vrittih in-house SMTP client — speaks the SMTP/ESMTP protocol directly over
 * TCP/TLS (Node `net`/`tls`/`dns` only). Replaces nodemailer entirely.
 *
 * Supports: implicit TLS (465), STARTTLS upgrade (587/25), AUTH LOGIN/PLAIN,
 * MX resolution for direct delivery, multiline responses, dot-stuffing, and
 * per-step timeouts. Zero third-party libraries.
 */
import net from "net"
import tls from "tls"
import { resolveMx } from "dns/promises"
import { randomBytes } from "crypto"

export interface SmtpAuth { user: string; pass: string }
export interface SmtpResponse { code: number; text: string }

export interface SmtpSendOptions {
  host: string
  port: number
  secure?: "tls" | "starttls" | false // 465 = tls, 587/25 = starttls, false = plaintext
  auth?: SmtpAuth
  from: string          // envelope MAIL FROM (bare address)
  to: string | string[] // envelope RCPT TO (bare addresses)
  raw: string           // full RFC 5322 message (headers + CRLF CRLF + body)
  ehloName?: string
  timeoutMs?: number
}

// ---------- response reader (handles multiline + socket upgrade) ----------
class Reader {
  private buf = ""
  private waiters: ((r: SmtpResponse) => void)[] = []
  private ready: SmtpResponse[] = []
  private stream?: NodeJS.ReadableStream
  private handler = (d: Buffer) => this.onData(d.toString("utf8"))

  attach(stream: NodeJS.ReadableStream) {
    if (this.stream) this.stream.off("data", this.handler)
    this.stream = stream
    stream.on("data", this.handler)
  }
  private onData(chunk: string) {
    this.buf += chunk
    for (;;) {
      const r = this.parse()
      if (!r) break
      const w = this.waiters.shift()
      if (w) w(r); else this.ready.push(r)
    }
  }
  private parse(): SmtpResponse | null {
    const lines = this.buf.split("\r\n")
    for (let i = 0; i < lines.length - 1; i++) {
      if (/^\d{3} /.test(lines[i])) {                 // terminator line (space after code)
        const resp = lines.slice(0, i + 1)
        this.buf = this.buf.slice(resp.join("\r\n").length + 2)
        return { code: parseInt(resp[resp.length - 1].slice(0, 3), 10), text: resp.join("\n") }
      }
    }
    return null
  }
  read(): Promise<SmtpResponse> {
    const r = this.ready.shift()
    return r ? Promise.resolve(r) : new Promise((res) => this.waiters.push(res))
  }
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64")
function dotStuff(raw: string): string {
  const body = raw.replace(/\r?\n/g, "\r\n")
  return body.split("\r\n").map((l) => (l.startsWith(".") ? "." + l : l)).join("\r\n")
}

/** Deliver one message to one SMTP server. Resolves on 250 after DATA. */
export async function smtpSend(opts: SmtpSendOptions): Promise<SmtpResponse> {
  const ehlo = opts.ehloName || process.env.MAIL_EHLO || "vrittih.online"
  const timeout = opts.timeoutMs ?? 20_000
  const rcpts = Array.isArray(opts.to) ? opts.to : [opts.to]
  const reader = new Reader()

  let socket: net.Socket | tls.TLSSocket = opts.secure === "tls"
    ? tls.connect({ host: opts.host, port: opts.port, servername: opts.host })
    : net.connect({ host: opts.host, port: opts.port })

  socket.setTimeout(timeout)
  const done = new Promise<never>((_, rej) => {
    socket.once("timeout", () => { socket.destroy(); rej(new Error("SMTP timeout")) })
    socket.once("error", (e) => rej(e))
  })

  async function connectReady() {
    await Promise.race([
      new Promise<void>((res) => socket.once(opts.secure === "tls" ? "secureConnect" : "connect", () => res())),
      done,
    ])
    reader.attach(socket)
  }
  async function cmd(line: string, expect: number[], secret = false): Promise<SmtpResponse> {
    socket.write(line + "\r\n")
    const r = await Promise.race([reader.read(), done])
    if (!expect.includes(r.code)) throw new Error(`SMTP "${secret ? "***" : line.split(/[: ]/)[0]}" → ${r.code} ${r.text.replace(/\n/g, " ")}`)
    return r
  }

  try {
    await connectReady()
    await Promise.race([reader.read(), done]) // greeting 220
    let caps = (await cmd(`EHLO ${ehlo}`, [250])).text

    if (opts.secure === "starttls" && /STARTTLS/i.test(caps)) {
      await cmd("STARTTLS", [220])
      const secured = tls.connect({ socket, servername: opts.host })
      await Promise.race([new Promise<void>((res, rej) => { secured.once("secureConnect", () => res()); secured.once("error", rej) }), done])
      socket = secured
      reader.attach(secured)
      caps = (await cmd(`EHLO ${ehlo}`, [250])).text
    }

    if (opts.auth) {
      if (/AUTH[ =-].*PLAIN/i.test(caps)) {
        await cmd(`AUTH PLAIN ${b64("\0" + opts.auth.user + "\0" + opts.auth.pass)}`, [235], true)
      } else {
        await cmd("AUTH LOGIN", [334])
        await cmd(b64(opts.auth.user), [334], true)
        await cmd(b64(opts.auth.pass), [235], true)
      }
    }

    await cmd(`MAIL FROM:<${opts.from}>`, [250])
    for (const r of rcpts) await cmd(`RCPT TO:<${r}>`, [250, 251])
    await cmd("DATA", [354])
    const data = dotStuff(opts.raw)
    socket.write(data + (data.endsWith("\r\n") ? "" : "\r\n") + ".\r\n")
    const final = await Promise.race([reader.read(), done])
    if (final.code !== 250) throw new Error(`SMTP DATA → ${final.code} ${final.text.replace(/\n/g, " ")}`)
    try { await cmd("QUIT", [221]) } catch { /* server may just close */ }
    return final
  } finally {
    socket.destroy()
  }
}

/** Resolve the best (lowest-priority) MX host for a domain, falling back to A. */
export async function resolveMailHost(domain: string): Promise<string> {
  try {
    const mx = await resolveMx(domain)
    if (mx.length) return mx.sort((a, b) => a.priority - b.priority)[0].exchange
  } catch { /* no MX */ }
  return domain
}

/** Build a minimal RFC 5322 message (text and/or HTML). */
export function buildMessage(o: { from: string; fromName?: string; to: string; subject: string; html?: string; text?: string }): string {
  const date = new Date().toUTCString().replace(/GMT$/, "+0000")
  const id = `<${randomBytes(8).toString("hex")}@${(o.from.split("@")[1] || "vrittih.online")}>`
  const headers = [
    `From: ${o.fromName ? `${o.fromName} <${o.from}>` : o.from}`,
    `To: ${o.to}`,
    `Subject: ${o.subject}`,
    `Date: ${date}`,
    `Message-ID: ${id}`,
    "MIME-Version: 1.0",
    `Content-Type: ${o.html ? 'text/html' : 'text/plain'}; charset="utf-8"`,
    "Content-Transfer-Encoding: 8bit",
  ]
  return headers.join("\r\n") + "\r\n\r\n" + (o.html ?? o.text ?? "").replace(/\r?\n/g, "\r\n")
}

/**
 * High-level: send a transactional email via the configured relay
 * (SMTP_HOST/PORT/USER/PASS). Returns null (logged) if no relay is configured.
 */
export async function sendMail(o: { to: string; subject: string; html?: string; text?: string; fromName?: string }): Promise<SmtpResponse | null> {
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!host || !user || !pass) {
    console.log(`[MAIL] (no relay configured) → ${o.to}: ${o.subject}`)
    return null
  }
  const port = Number(process.env.SMTP_PORT || 465)
  const from = user
  const raw = buildMessage({ from, fromName: o.fromName || "Vrittih", to: o.to, subject: o.subject, html: o.html, text: o.text })
  return smtpSend({ host, port, secure: port === 465 ? "tls" : "starttls", auth: { user, pass }, from, to: o.to, raw })
}
