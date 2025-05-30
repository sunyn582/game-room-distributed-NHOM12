const express = require("express")
const http = require("http")
const socketIo = require("socket.io")
const cors = require("cors")
const path = require("path")
const { v4: uuidv4 } = require("uuid")
const InfluxDBService = require("../api/influxdb")
const DashboardService = require("../api/dashboard")

const app = express()
const server = http.createServer(app)
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
})

const PORT = process.env.PORT || 3000
const INSTANCE_ID = process.env.INSTANCE_ID || "default"

// Initialize InfluxDB
const influxService = new InfluxDBService()
const dashboardService = new DashboardService()

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, "../view")))

// In-memory storage cho demo (trong production nên dùng Redis)
const rooms = new Map()
const userPings = new Map()

// Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../view/index.html"))
})

app.get("/room/:roomId", (req, res) => {
  res.sendFile(path.join(__dirname, "../view/room.html"))
})

// API để tạo phòng
app.post("/api/create-room", async (req, res) => {
  const startTime = Date.now()

  try {
    const roomId = uuidv4().substring(0, 8)
    const room = {
      id: roomId,
      name: req.body.name || `Room ${roomId}`,
      users: [],
      createdAt: new Date(),
      instanceId: INSTANCE_ID,
    }

    rooms.set(roomId, room)

    const responseTime = Date.now() - startTime

    // Ghi vào InfluxDB
    await influxService.writeRoomCreation(roomId, responseTime, INSTANCE_ID)

    res.json({
      success: true,
      roomId: roomId,
      room: room,
      responseTime: responseTime,
    })
  } catch (error) {
    console.error("Error creating room:", error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// API để lấy thông tin phòng
app.get("/api/room/:roomId", async (req, res) => {
  const startTime = Date.now()
  const roomId = req.params.roomId

  try {
    const room = rooms.get(roomId)
    if (!room) {
      return res.status(404).json({ success: false, error: "Room not found" })
    }

    const responseTime = Date.now() - startTime

    res.json({
      success: true,
      room: room,
      responseTime: responseTime,
    })
  } catch (error) {
    console.error("Error getting room:", error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// API để lấy thống kê
app.get("/api/stats", async (req, res) => {
  try {
    const stats = await influxService.getRoomStats()
    res.json({
      success: true,
      stats: stats,
      activeRooms: rooms.size,
      instanceId: INSTANCE_ID,
    })
  } catch (error) {
    console.error("Error getting stats:", error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// API dashboard cho nhóm 12
app.get("/api/nhom12/stats", async (req, res) => {
  try {
    const timeRange = req.query.range || "1h"
    const stats = await dashboardService.getNhom12Stats(timeRange)
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error getting nhom12 stats:", error)
    res.status(500).json({ success: false, error: error.message })
  }
})

app.get("/api/nhom12/top-rooms", async (req, res) => {
  try {
    const limit = Number.parseInt(req.query.limit) || 5
    const topRooms = await dashboardService.getTopRoomsByPing(limit)
    res.json({
      success: true,
      data: topRooms,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error getting top rooms:", error)
    res.status(500).json({ success: false, error: error.message })
  }
})

app.get("/api/nhom12/instances", async (req, res) => {
  try {
    const instanceStats = await dashboardService.getInstanceStats()
    res.json({
      success: true,
      data: instanceStats,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error getting instance stats:", error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Socket.IO handling
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id} on instance ${INSTANCE_ID}`)

  // Vào phòng
  socket.on("join-room", async (data) => {
    const startTime = Date.now()
    const { roomId, username } = data

    try {
      const room = rooms.get(roomId)
      if (!room) {
        socket.emit("error", { message: "Room not found" })
        return
      }

      const user = {
        id: socket.id,
        username: username,
        joinedAt: new Date(),
        ping: 0,
      }

      room.users.push(user)
      socket.join(roomId)
      socket.roomId = roomId
      socket.username = username

      const responseTime = Date.now() - startTime

      // Ghi vào InfluxDB
      await influxService.writeRoomJoin(roomId, socket.id, responseTime, INSTANCE_ID)

      // Thông báo cho tất cả user trong phòng
      io.to(roomId).emit("user-joined", {
        user: user,
        room: room,
        responseTime: responseTime,
      })

      // Gửi danh sách user hiện tại
      socket.emit("room-users", room.users)
    } catch (error) {
      console.error("Error joining room:", error)
      socket.emit("error", { message: error.message })
    }
  })

  // Xử lý tin nhắn chat
  socket.on("chat-message", (data) => {
    if (socket.roomId) {
      io.to(socket.roomId).emit("chat-message", {
        username: socket.username,
        message: data.message,
        timestamp: new Date(),
      })
    }
  })

  // Xử lý ping test
  socket.on("ping-test", (timestamp) => {
    socket.emit("pong-test", timestamp)
  })

  // Cập nhật ping của user
  socket.on("update-ping", async (pingValue) => {
    if (socket.roomId) {
      const room = rooms.get(socket.roomId)
      if (room) {
        const user = room.users.find((u) => u.id === socket.id)
        if (user) {
          user.ping = pingValue
          userPings.set(socket.id, pingValue)

          // Tính ping trung bình của phòng
          const totalPing = room.users.reduce((sum, u) => sum + (u.ping || 0), 0)
          const averagePing = room.users.length > 0 ? totalPing / room.users.length : 0

          // Gửi cập nhật ping cho tất cả user trong phòng
          io.to(socket.roomId).emit("ping-update", {
            averagePing: Math.round(averagePing),
            users: room.users.map((u) => ({
              username: u.username,
              ping: u.ping,
            })),
          })
        }
      }
    }
  })

  // Xử lý disconnect
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`)

    if (socket.roomId) {
      const room = rooms.get(socket.roomId)
      if (room) {
        room.users = room.users.filter((u) => u.id !== socket.id)
        userPings.delete(socket.id)

        // Thông báo user rời phòng
        io.to(socket.roomId).emit("user-left", {
          userId: socket.id,
          username: socket.username,
          remainingUsers: room.users,
        })

        // Xóa phòng nếu không còn user
        if (room.users.length === 0) {
          rooms.delete(socket.roomId)
        }
      }
    }
  })
})

// Tự động ghi ping data mỗi 10 giây
setInterval(async () => {
  for (const [roomId, room] of rooms.entries()) {
    if (room.users.length > 0) {
      const totalPing = room.users.reduce((sum, u) => sum + (u.ping || 0), 0)
      const averagePing = totalPing / room.users.length

      try {
        await influxService.writeRoomPing(roomId, averagePing, room.users.length, INSTANCE_ID)
      } catch (error) {
        console.error("Error writing ping data:", error)
      }
    }
  }
}, 10000)

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} - Instance: ${INSTANCE_ID}`)
})