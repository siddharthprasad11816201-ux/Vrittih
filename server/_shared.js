// In-house helpers for the plain-Node server processes (chat/signal/worker).
// Replaces `dotenv` and `jsonwebtoken` with Node built-ins. Zero third-party deps.
const fs = require("fs")
const path = require("path")
const crypto = require("crypto")

// Load KEY=VALUE pairs from .env into process.env (does not override existing).
function loadEnv() {
  try {
    const txt = fs.readFileSync(path.resolve(process.cwd(), ".env"), "utf8")
    for (const line of txt.split(/\r?\n/)) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line)
      if (!m || line.trim().startsWith("#")) continue
      let v = m[2]
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      if (process.env[m[1]] === undefined) process.env[m[1]] = v
    }
  } catch { /* no .env — rely on the environment */ }
}

// Verify a Vrittih HS256 JWT (matches lib/jwt.ts). Returns payload or null.
function verifyJwt(token, secret) {
  try {
    const [h, c, s] = String(token).split(".")
    if (!h || !c || !s) return null
    const expected = crypto.createHmac("sha256", secret).update(h + "." + c).digest("base64")
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
    const a = Buffer.from(s), b = Buffer.from(expected)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
    const payload = JSON.parse(Buffer.from(c.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"))
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null
    return payload
  } catch { return null }
}

module.exports = { loadEnv, verifyJwt }
