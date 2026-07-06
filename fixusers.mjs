import { PrismaClient } from "@prisma/client"
const p = new PrismaClient()
const r = await p.user.updateMany({ where:{}, data:{ paid:true, paidAt:new Date() } })
console.log("Updated:", r.count, "users")
await p.$disconnect()
