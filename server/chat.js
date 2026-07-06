const { loadEnv, verifyJwt } = require("./_shared")
loadEnv()
const { WebSocketServer } = require("ws")

const PORT = 3001
const wss = new WebSocketServer({ port: PORT })
const clients = new Map()

wss.on("connection", (ws, req) => {
  let userId = null

  ws.on("message", async (raw) => {
    try {
      const msg = JSON.parse(raw.toString())

      if (msg.type === "AUTH") {
        const payload = verifyJwt(msg.token, process.env.JWT_SECRET || "dev_secret_change_in_production")
        if (!payload) { ws.send(JSON.stringify({ type: "ERROR", error: "Invalid token" })); return }
        userId = payload.userId
        clients.set(userId, ws)
        ws.send(JSON.stringify({ type: "AUTH_OK", userId }))
        console.log(`[WS] User ${userId} connected`)
        return
      }

      if (!userId) { ws.send(JSON.stringify({ type: "ERROR", error: "Not authenticated" })); return }

      if (msg.type === "MESSAGE") {
        const { conversationId, content } = msg
        if (!conversationId || !content?.trim()) return
        const { PrismaClient } = require("@prisma/client")
        const prisma = new PrismaClient()
        const participant = await prisma.conversationParticipant.findUnique({
          where: { conversationId_userId: { conversationId, userId } }
        })
        if (!participant) { ws.send(JSON.stringify({ type: "ERROR", error: "Not a participant" })); return }
        const message = await prisma.message.create({
          data: { conversationId, senderId: userId, content: content.trim() },
          include: { sender: { select: { id: true, name: true, avatar: true } } }
        })
        await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } })
        const participants = await prisma.conversationParticipant.findMany({ where: { conversationId } })
        participants.forEach(p => {
          const client = clients.get(p.userId)
          if (client && client.readyState === 1) {
            client.send(JSON.stringify({ type: "NEW_MESSAGE", message }))
          }
        })
        await prisma.$disconnect()
      }

      if (msg.type === "TYPING") {
        const { conversationId } = msg
        const { PrismaClient } = require("@prisma/client")
        const prisma = new PrismaClient()
        const participants = await prisma.conversationParticipant.findMany({ where: { conversationId } })
        participants.forEach(p => {
          if (p.userId !== userId) {
            const client = clients.get(p.userId)
            if (client && client.readyState === 1) {
              client.send(JSON.stringify({ type: "TYPING", userId, conversationId }))
            }
          }
        })
        await prisma.$disconnect()
      }

      if (msg.type === "READ") {
        const { conversationId } = msg
        const { PrismaClient } = require("@prisma/client")
        const prisma = new PrismaClient()
        await prisma.conversationParticipant.update({
          where: { conversationId_userId: { conversationId, userId } },
          data: { lastReadAt: new Date() }
        })
        await prisma.message.updateMany({
          where: { conversationId, senderId: { not: userId }, read: false },
          data: { read: true }
        })
        await prisma.$disconnect()
      }
    } catch (err) {
      console.error("[WS] Error:", err.message)
    }
  })

  ws.on("close", () => {
    if (userId) { clients.delete(userId); console.log(`[WS] User ${userId} disconnected`) }
  })

  ws.on("error", (err) => console.error("[WS] Socket error:", err.message))
})

console.log(`[WS] Chat server running on ws://localhost:${PORT}`)