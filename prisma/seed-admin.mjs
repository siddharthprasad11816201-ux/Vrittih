// Bootstraps (or refreshes) a SUPER_ADMIN account so the admin panel is reachable.
// Usage:  npm run seed:admin
// Override defaults with env vars: SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD, SUPERADMIN_NAME
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

const email = process.env.SUPERADMIN_EMAIL || "superadmin@vrittih.online"
const name = process.env.SUPERADMIN_NAME || "Super Admin"

// A hardcoded default password meant every deployment that ran this without setting
// SUPERADMIN_PASSWORD shipped a PUBLICLY KNOWN super-admin credential (this file is in
// git). Outside development we now refuse to run without an explicit password, and when
// one is not supplied locally we generate a random one instead of reusing a known string.
const isProd = process.env.NODE_ENV === "production" || (process.env.DATABASE_URL || "").startsWith("postgres")
let password = process.env.SUPERADMIN_PASSWORD || ""
let generated = false
if (!password) {
  if (isProd) {
    console.error("")
    console.error("Refusing to seed a super admin without SUPERADMIN_PASSWORD.")
    console.error("This target looks like production. Set a strong SUPERADMIN_PASSWORD and re-run.")
    console.error("")
    process.exit(1)
  }
  password = (await import("crypto")).randomBytes(15).toString("base64url")
  generated = true
}

const hashed = await bcrypt.hash(password, 12)

const user = await prisma.user.upsert({
  where: { email },
  update: {
    role: "SUPER_ADMIN",
    paid: true,
    idVerified: true,
    twoFactorEnabled: false,
    banned: false,
    password: hashed,
  },
  create: {
    name,
    email,
    password: hashed,
    role: "SUPER_ADMIN",
    paid: true,
    paidAt: new Date(),
    idVerified: true,
    profile: { create: {} },
  },
  select: { id: true, email: true, role: true },
})

console.log("\n✅ Super admin ready")
console.log("   id:       ", user.id)
console.log("   email:    ", email)
if (generated) console.log("   password: ", password)
else console.log("  Password: (as provided via SUPERADMIN_PASSWORD)")
console.log("   role:     ", user.role)
console.log("\n   Sign in at /login, then open /admin/super\n")

await prisma.$disconnect()
