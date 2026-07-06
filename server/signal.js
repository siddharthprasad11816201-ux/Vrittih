const { createServer } = require("http")
const { Server } = require("socket.io")

const PORT = 3002
const httpServer = createServer()
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET","POST"] }
})

// rooms: Map<roomCode, Set<socketId>>
const rooms = new Map()
// socketToRoom: Map<socketId, roomCode>
const socketToRoom = new Map()
// socketToUser: Map<socketId, { userId, name, role }>
const socketToUser = new Map()

io.on("connection", (socket) => {
  console.log("[SIGNAL] Connected:", socket.id)

  socket.on("join-room", ({ roomCode, userId, name, role }) => {
    socket.join(roomCode)
    socketToRoom.set(socket.id, roomCode)
    socketToUser.set(socket.id, { userId, name, role })

    if (!rooms.has(roomCode)) rooms.set(roomCode, new Set())
    rooms.get(roomCode).add(socket.id)

    // Tell existing participants about new peer
    socket.to(roomCode).emit("peer-joined", {
      socketId: socket.id, userId, name, role
    })

    // Tell new peer about existing participants
    const peers = []
    rooms.get(roomCode).forEach(sid => {
      if (sid !== socket.id) {
        const user = socketToUser.get(sid)
        peers.push({ socketId: sid, ...user })
      }
    })
    socket.emit("existing-peers", peers)

    // Room participant count
    io.to(roomCode).emit("room-count", rooms.get(roomCode).size)
    console.log(`[SIGNAL] ${name} joined room ${roomCode} (${rooms.get(roomCode).size} participants)`)
  })

  // WebRTC signaling
  socket.on("offer", ({ to, offer }) => {
    socket.to(to).emit("offer", { from: socket.id, offer })
  })

  socket.on("answer", ({ to, answer }) => {
    socket.to(to).emit("answer", { from: socket.id, answer })
  })

  socket.on("ice-candidate", ({ to, candidate }) => {
    socket.to(to).emit("ice-candidate", { from: socket.id, candidate })
  })

  // Chat in room
  socket.on("room-message", ({ roomCode, message }) => {
    const user = socketToUser.get(socket.id)
    io.to(roomCode).emit("room-message", {
      from: socket.id,
      user,
      message,
      timestamp: new Date().toISOString()
    })
  })

  // Screen share notification
  socket.on("screen-share-start", ({ roomCode }) => {
    const user = socketToUser.get(socket.id)
    socket.to(roomCode).emit("screen-share-start", { socketId: socket.id, user })
  })

  socket.on("screen-share-stop", ({ roomCode }) => {
    socket.to(roomCode).emit("screen-share-stop", { socketId: socket.id })
  })

  // Hand raise
  socket.on("raise-hand", ({ roomCode }) => {
    const user = socketToUser.get(socket.id)
    io.to(roomCode).emit("raise-hand", { socketId: socket.id, user })
  })

  // Disconnect
  socket.on("disconnect", () => {
    const roomCode = socketToRoom.get(socket.id)
    const user = socketToUser.get(socket.id)
    if (roomCode && rooms.has(roomCode)) {
      rooms.get(roomCode).delete(socket.id)
      if (rooms.get(roomCode).size === 0) rooms.delete(roomCode)
      else io.to(roomCode).emit("peer-left", { socketId: socket.id, user })
      io.to(roomCode).emit("room-count", rooms.get(roomCode)?.size || 0)
    }
    socketToRoom.delete(socket.id)
    socketToUser.delete(socket.id)
    console.log("[SIGNAL] Disconnected:", socket.id, user?.name)
  })
})

httpServer.listen(PORT, () => console.log(`[SIGNAL] WebRTC signaling server on port ${PORT}`))