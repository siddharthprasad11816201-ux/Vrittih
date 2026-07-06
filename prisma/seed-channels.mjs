import { PrismaClient } from "@prisma/client"
const p = new PrismaClient()
const admin = await p.user.findFirst({ where: { role: "SUPER_ADMIN" } })
if (!admin) { console.log("No super admin found — run seed-admin.mjs first"); await p.$disconnect(); process.exit(1) }
const channels = [
  { name:"general", description:"General discussion for everyone" },
  { name:"jobs", description:"Job postings, tips, and career advice" },
  { name:"introductions", description:"Introduce yourself to the community" },
  { name:"interview-prep", description:"Interview tips, mock questions, experiences" },
  { name:"employers", description:"For employers — hiring tips and best practices" },
  { name:"off-topic", description:"Anything and everything else" },
]
for (const ch of channels) {
  const existing = await p.channel.findUnique({ where: { name: ch.name } })
  if (!existing) {
    await p.channel.create({
      data: {
        name: ch.name, description: ch.description,
        createdById: admin.id,
        members: { create: { userId: admin.id, role: "ADMIN" } },
      },
    })
    console.log("Created channel:", ch.name)
  } else {
    console.log("Already exists:", ch.name)
  }
}
await p.$disconnect()
console.log("Done")