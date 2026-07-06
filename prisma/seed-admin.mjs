// Bootstraps (or refreshes) a SUPER_ADMIN account so the admin panel is reachable.
// Usage:  npm run seed:admin
// Override defaults with env vars: SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD, SUPERADMIN_NAME
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

const email = process.env.SUPERADMIN_EMAIL || "superadmin@vrittih.online"
const password = process.env.SUPERADMIN_PASSWORD || "SuperAdmin@2026"
const name = process.env.SUPERADMIN_NAME || "Super Admin"

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
console.log("   password: ", password)
console.log("   role:     ", user.role)
console.log("\n   Sign in at /login, then open /admin/super\n")

await prisma.$disconnect()
