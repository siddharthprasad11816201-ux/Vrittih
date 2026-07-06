import { PrismaClient } from "@prisma/client"
const p = new PrismaClient()
const [users, jobs] = await Promise.all([
  p.user.findMany({ select:{ name:true, email:true, role:true, paid:true } }),
  p.job.findMany({ select:{ title:true, company:true, active:true } })
])
console.log("USERS:"); console.table(users)
console.log("JOBS:"); console.table(jobs)
await p.$disconnect()
