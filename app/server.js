
const express = require("express")
const http = require("http")
const socketIo = require("socket.io")
const cors = require("cors")
const helmet = require("helmet")
const path = require("path")

// Import các modules mới
const HealthChecker = require("../api/health/health-check")
const CircuitBreaker = require("../api/middleware/circuit-breaker")
const DatabaseSharding = require("../api/services/database-sharding")
const MonitoringService = require("../api/services/monitoring-service")

const app = express()
const server = http.createServer(app)
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
})

// Middleware
app.use(helmet())
app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, "../view")))

// Initialize services
const healthChecker = new HealthChecker()
const dbSharding = new DatabaseSharding()
const monitoring = new MonitoringService()

// Circuit breakers for external services
const dbCircuitBreaker = new CircuitBreaker("database", {
  failureThreshold: 5,
  timeout: 60000,
  monitor: (msg) => console.log(`[Circuit Breaker] ${msg}`),
})

const redisCircuitBreaker = new CircuitBreaker("redis", {
  failureThreshold: 3,
  timeout: 30000,
})

// Middleware để log requests
app.use((req, res, next) => {
  const startTime = Date.now()

  res.on("finish", () => {
    const responseTime = Date.now() - startTime

    // Log to monitoring system
    monitoring.logApiMetrics(req.path, req.method, responseTime, res.statusCode)

    console.log(`${req.method} ${req.path} - ${res.statusCode} - ${responseTime}ms`)
  })

  next()
})

// Health check endpoint
app.get("/health", async (req, res) => {
  try {
    const healthStatus = await healthChecker.runAllChecks()
    const statusCode = healthStatus.status === "healthy" ? 200 : 503
    res.status(statusCode).json(healthStatus)
  } catch (error) {
    res.status(503).json({
      status: "error",
      message: error.message,
      timestamp: new Date().toISOString(),
    })
  }
})

// API Routes với Circuit Breaker protection
app.get("/api/rooms", async (req, res) => {
  try {
    const rooms = await dbCircuitBreaker.execute(async () => {
      // Lấy rooms từ tất cả shards
      return await dbSharding.queryAllShards("room_data", "24h")
    })

    res.json({ rooms, count: rooms.length })
  } catch (error) {
    console.error("Error fetching rooms:", error)
    res.status(500).json({ error: "Failed to fetch rooms" })
  }
})

app.post("/api/rooms", async (req, res) => {
  try {
    const { name, maxPlayers, createdBy } = req.body
    const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const roomData = {
      id: roomId,
      name,
      maxPlayers: maxPlayers || 4,
      createdBy,
      createdAt: new Date().toISOString(),
      players: [],
      status: "waiting",
    }

    // Lưu vào shard thích hợp
    await dbCircuitBreaker.execute(async () => {
      await dbSharding.writeRoomData(roomId, roomData)
    })

    // Log user activity
    monitoring.logUserActivity(createdBy, "room_created", roomId)

    // Broadcast to all clients
    io.emit("room:created", roomData)

    res.status(201).json(roomData)
  } catch (error) {
    console.error("Error creating room:", error)
    res.status(500).json({ error: "Failed to create room" })
  }
})

app.get("/api/rooms/:roomId", async (req, res) => {
  try {
    const { roomId } = req.params

    const roomData = await dbCircuitBreaker.execute(async () => {
      return await dbSharding.queryRoomData(roomId, "1h")
    })

    if (roomData.length === 0) {
      return res.status(404).json({ error: "Room not found" })
    }

    res.json(roomData[0])
  } catch (error) {
    console.error("Error fetching room:", error)
    res.status(500).json({ error: "Failed to fetch room" })
  }
})

app.post("/api/rooms/:roomId/join", async (req, res) => {
  try {
    const { roomId } = req.params
    const { userId, username } = req.body

    // Log user activity
    monitoring.logUserActivity(userId, "room_joined", roomId)

    // Broadcast to room
    io.to(roomId).emit("user:joined", { userId, username, roomId })

    res.json({ success: true, message: "Joined room successfully" })
  } catch (error) {
    console.error("Error joining room:", error)
    res.status(500).json({ error: "Failed to join room" })
  }
})

// Test endpoints cho stress testing
app.post("/api/test/shard-write", async (req, res) => {
  try {
    const { roomId, userId, action } = req.body

    await dbSharding.writeUserActivity(userId, {
      type: action,
      roomId,
      timestamp: new Date().toISOString(),
    })

    res.json({ success: true, shard: dbSharding.getShardForUser(userId) })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get("/api/test/circuit-breaker", async (req, res) => {
  try {
    const shouldFail = req.query.fail === "true"

    if (shouldFail) {
      throw new Error("Simulated failure for circuit breaker testing")
    }

    res.json({ success: true, message: "Circuit breaker test passed" })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Monitoring endpoints
app.get("/api/monitoring/stats", async (req, res) => {
  try {
    const stats = {
      activeUsers: await monitoring.getActiveUsers("1h"),
      averageResponseTime: await monitoring.getAverageResponseTime("1h"),
      shardStatus: await dbSharding.getShardStatus(),
      circuitBreakers: {
        database: dbCircuitBreaker.getStatus(),
        redis: redisCircuitBreaker.getStatus(),
      },
      systemMetrics: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        instanceId: process.env.INSTANCE_ID || "unknown",
      },
    }

    res.json(stats)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`)

  // Log connection
  monitoring.logUserActivity(socket.id, "connected")

  socket.on("join:room", async (data) => {
    try {
      const { roomId, userId, username } = data

      socket.join(roomId)

      // Log activity
      monitoring.logUserActivity(userId, "joined_room", roomId)

      // Notify others in room
      socket.to(roomId).emit("user:joined", { userId, username })

      socket.emit("join:success", { roomId })
    } catch (error) {
      socket.emit("join:error", { error: error.message })
    }
  })

  socket.on("leave:room", async (data) => {
    try {
      const { roomId, userId } = data

      socket.leave(roomId)

      // Log activity
      monitoring.logUserActivity(userId, "left_room", roomId)

      // Notify others in room
      socket.to(roomId).emit("user:left", { userId })
    } catch (error) {
      socket.emit("leave:error", { error: error.message })
    }
  })

  socket.on("chat:message", async (data) => {
    try {
      const { roomId, userId, username, message } = data

      // Log activity
      monitoring.logUserActivity(userId, "sent_message", roomId)

      // Broadcast message to room
      io.to(roomId).emit("chat:message", {
        userId,
        username,
        message,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      socket.emit("chat:error", { error: error.message })
    }
  })

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`)
    monitoring.logUserActivity(socket.id, "disconnected")
  })
})

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully")
  server.close(() => {
    console.log("Process terminated")
    process.exit(0)
  })
})

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully")
  server.close(() => {
    console.log("Process terminated")
    process.exit(0)
  })
})

// Start server
const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📊 Instance ID: ${process.env.INSTANCE_ID || "unknown"}`)
  console.log(`🏥 Health check: http://localhost:${PORT}/health`)

  // Log system metrics periodically
  setInterval(() => {
    monitoring.logSystemMetrics()
  }, 30000) // Every 30 seconds
})

module.exports = { app, server, io }
