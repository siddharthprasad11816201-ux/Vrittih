/**
 * Assembles an RFC 5322 message and applies an in-house DKIM signature using a
 * verified employer domain's key. The signed raw message is what an SMTP client
 * hands to the receiving mail server; receivers validate the DKIM-Signature
 * against the domain's published DNS key.
 */
import { randomBytes } from "crypto"
import { decryptSecret } from "@/lib/crypto/secretbox"
import { prisma } from "@/lib/prisma"
import { signMessage } from "@/lib/dkim"
import { smtpSend } from "@/lib/smtp"

export interface OutboundMail {
  fromName: string
  fromLocalPart: string  // e.g. "hr" → hr@<domain>
  domain: string
  toEmail: string
  subject: string
  body: string
}

export interface SignedMessage {
  raw: string          // full message incl. DKIM-Signature header
  fromAddress: string
  dkim: boolean
}

/**
 * Build a message, signing it if the sender owns a *verified* domain.
 * Returns the raw message ready for SMTP delivery.
 */
export async function buildSignedEmail(userId: string, mail: OutboundMail): Promise<SignedMessage> {
  const record = await prisma.emailDomain.findUnique({ where: { domain: mail.domain.toLowerCase() } })
  const canSign = !!record && record.userId === userId && record.verified

  const fromAddress = `${mail.fromLocalPart}@${mail.domain}`
  const date = new Date().toUTCString().replace(/GMT$/, "+0000")
  const messageId = `<${randomBytes(8).toString("hex")}@${mail.domain}>`
  const headers: { name: string; value: string }[] = [
    { name: "From", value: `${mail.fromName} <${fromAddress}>` },
    { name: "To", value: mail.toEmail },
    { name: "Subject", value: mail.subject },
    { name: "Date", value: date },
    { name: "Message-ID", value: messageId },
    { name: "MIME-Version", value: "1.0" },
    { name: "Content-Type", value: 'text/plain; charset="utf-8"' },
  ]
  const body = mail.body.replace(/\r?\n/g, "\r\n")

  let dkimHeader: string | null = null
  if (canSign) {
    dkimHeader = signMessage({
      // Stored encrypted at rest when SECRET_ENCRYPTION_KEY is set; decryptSecret is a
      // no-op for rows written before encryption was enabled.
      privateKeyPem: decryptSecret(record!.dkimPrivateKey),
      domain: mail.domain,
      selector: record!.selector,
      headers,
      body,
      signHeaders: ["from", "to", "subject", "date", "message-id", "mime-version", "content-type"],
    })
  }

  const headerLines = headers.map((h) => `${h.name}: ${h.value}`)
  const raw = [...(dkimHeader ? [dkimHeader] : []), ...headerLines, "", body].join("\r\n")
  return { raw, fromAddress, dkim: canSign }
}

export interface DeliveryResult extends SignedMessage {
  delivered: boolean
  detail: string     // relay's final response text
}

/**
 * Sign a message with the sender's *verified* domain key and hand the raw,
 * DKIM-signed message to the configured SMTP relay for real delivery. Throws
 * — never silently succeeds — if the domain can't be signed for or if no relay
 * is configured, so callers can only report success when a real send ran.
 */
export async function sendSignedEmail(userId: string, mail: OutboundMail): Promise<DeliveryResult> {
  const signed = await buildSignedEmail(userId, mail)
  if (!signed.dkim) {
    throw new Error(`${mail.domain} is not a verified sending domain you own — add and verify it in Settings → Email domains before sending from it.`)
  }

  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!host || !user || !pass) {
    throw new Error("Outbound email is not configured — set SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS to send from your domain.")
  }

  const port = Number(process.env.SMTP_PORT || 465)
  const res = await smtpSend({
    host,
    port,
    secure: port === 465 ? "tls" : "starttls",
    auth: { user, pass },
    from: signed.fromAddress,   // envelope MAIL FROM = the verified domain address
    to: mail.toEmail,
    raw: signed.raw,
  })
  return { ...signed, delivered: res.code === 250, detail: res.text }
}
