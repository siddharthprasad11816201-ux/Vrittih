/**
 * Assembles an RFC 5322 message and applies an in-house DKIM signature using a
 * verified employer domain's key. The signed raw message is what an SMTP client
 * hands to the receiving mail server; receivers validate the DKIM-Signature
 * against the domain's published DNS key.
 */
import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { signMessage } from "@/lib/dkim"

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
      privateKeyPem: record!.dkimPrivateKey,
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
