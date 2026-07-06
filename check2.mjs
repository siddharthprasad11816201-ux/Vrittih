import { PrismaClient } from "@prisma/client"
const p = new PrismaClient()
const tables = await p.$queryRaw`SELECT name FROM sqlite_master WHERE type="table" ORDER BY name`
console.table(tables)
await p.$disconnect()
