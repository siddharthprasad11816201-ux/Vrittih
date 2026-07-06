import { PrismaClient } from "@prisma/client"
const p = new PrismaClient()
await p.job.updateMany({ where:{ salary:{ contains:"?" } }, data:{ salary:"See description" } })
const jobs = await p.job.findMany({ select:{ id:true, title:true, salary:true } })
console.table(jobs)
await p.$disconnect()
