const express = require("express")
const http = require("http")
const socketIo = require("socket.io")
const Redis = require("ioredis")
const { InfluxDB, Point } = require("@influxdata/influxdb-client")
const path = require("path")
const { v4: uuidv4 } = require("uuid")

const app = express()
const server = http.createServer(app)
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
})

// Configuration
const config = {
  port: process.env.PORT || 3000,
  appId: process.env.APP_ID || "app1",
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  influxUrl: process.env.INFLUXDB_URL || "http://localhost:8086",
  influxToken: process.env.INFLUXDB_TOKEN || "your-token-here",
  influxOrg: process.env.INFLUXDB_ORG || "gameroom-org",
  influxBucket: process.env.INFLUXDB_BUCKET || "gameroom-bucket",
}

// Initialize Redis
const redis = new Redis(config.redisUrl, {
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
})

// Initialize InfluxDB
const influxDB = new InfluxDB({
  url: config.influxUrl,
  token: config.influxToken,
})
const writeApi = influxDB.getWriteApi(config.influxOrg, config.influxBucket)

// Middleware
app.use(express.json())
app.use(express.static(path.join(__dirname, "../view")))

// In-memory storage for this instance
const localRooms = new Map()
const userPings = new Map()

// Distributed room management
class RoomManager {
  constructor() {
    this.setupRedisSubscriptions()
  }

  async setupRedisSubscriptions() {
    const subscriber = new Redis(config.redisUrl)
    subscriber.subscribe("room:created", "room:updated", "room:deleted")

    subscriber.on("message", (channel, message) => {
      const data = JSON.parse(message)
      this.handleDistributedEvent(channel, data)
    })
  }

  handleDistributedEvent(channel, data) {
    switch (channel) {
      case "room:created":
        this.syncRoomCreated(data)
        break
      case "room:updated":
        this.syncRoomUpdated(data)
        break
      case "room:deleted":
        this.syncRoomDeleted(data)
        break
    }
  }

  async createRoom(roomName, creatorId) {
    const roomId = this.generateRoomId()
    const room = {
      id: roomId,
      name: roomName,
      createdAt: new Date().toISOString(),
      createdBy: creatorId,
      members: [creatorId],
      avgPing: 0,
      appInstance: config.appId,
    }

    // Store locally
    localRooms.set(roomId, room)

    // Store in Redis for distribution
    await redis.hset(`room:${roomId}`, room)
    await redis.sadd("rooms:active", roomId)

    // Publish to other instances
    await redis.publish("room:created", JSON.stringify(room))

    // Log to InfluxDB
    await this.logRoomEvent("room_created", roomId, room)

    return room
  }

  generateRoomId() {
    return `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  async logRoomEvent(event, roomId, data) {
    try {
      const point = new Point(event)
        .tag("room_id", roomId)
        .tag("app_instance", config.appId)
        .floatField("avg_ping", data.avgPing || 0)
        .intField("member_count", data.members ? data.members.length : 0)
        .timestamp(new Date())

      writeApi.writePoint(point)
      await writeApi.flush()
    } catch (error) {
      console.error("Failed to log to InfluxDB:", error)
    }
  }

  async updateRoomPing(roomId, newPing) {
    const room = localRooms.get(roomId)
    if (!room) return

    room.avgPing = newPing
    room.lastPingUpdate = new Date().toISOString()

    // Update Redis
    await redis.hset(`room:${roomId}`, "avgPing", newPing, "lastPingUpdate", room.lastPingUpdate)

    // Publish update
    await redis.publish("room:updated", JSON.stringify(room))

    // Log to InfluxDB
    await this.logRoomEvent("ping_update", roomId, room)
  }

  syncRoomCreated(room) {
    if (room.appInstance !== config.appId) {
      localRooms.set(room.id, room)
    }
  }

  syncRoomUpdated(room) {
    if (localRooms.has(room.id)) {
      localRooms.set(room.id, room)
    }
  }

  syncRoomDeleted(data) {
    localRooms.delete(data.roomId)
  }

  getGameSuggestion(avgPing) {
    if (avgPing < 50) {
      return {
        category: "Competitive",
        games: ["Counter-Strike 2", "Valorant", "League of Legends", "Rocket League"],
        reason: "Low ping - perfect for competitive gaming!",
      }
    } else if (avgPing < 100) {
      return {
        category: "Action",
        games: ["Fortnite", "Apex Legends", "Call of Duty", "Overwatch 2"],
        reason: "Good ping - suitable for fast-paced action games",
      }
    } else if (avgPing < 150) {
      return {
        category: "Strategy",
        games: ["Civilization VI", "Age of Empires IV", "StarCraft II", "Chess.com"],
        reason: "Moderate ping - strategy games work well",
      }
    } else {
      return {
        category: "Turn-based",
        games: ["Hearthstone", "Gwent", "Auto Chess", "Board Game Arena"],
        reason: "High ping - turn-based games recommended",
      }
    }
  }
}

const roomManager = new RoomManager()

// API Routes
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    appId: config.appId,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

app.post("/api/rooms", async (req, res) => {
  try {
    const { roomName } = req.body
    const creatorId = req.headers["x-user-id"] || uuidv4()

    if (!roomName || roomName.trim().length === 0) {
      return res.status(400).json({ error: "Room name is required" })
    }

    const room = await roomManager.createRoom(roomName.trim(), creatorId)
    res.json(room)
  } catch (error) {
    console.error("Error creating room:", error)
    res.status(500).json({ error: "Failed to create room" })
  }
})

app.get("/api/rooms", async (req, res) => {
  try {
    const rooms = Array.from(localRooms.values())
    res.json(rooms)
  } catch (error) {
    console.error("Error fetching rooms:", error)
    res.status(500).json({ error: "Failed to fetch rooms" })
  }
})

app.get("/api/rooms/:roomId/suggestion", (req, res) => {
  try {
    const { roomId } = req.params
    const room = localRooms.get(roomId)

    if (!room) {
      return res.status(404).json({ error: "Room not found" })
    }

    const suggestion = roomManager.getGameSuggestion(room.avgPing)
    res.json(suggestion)
  } catch (error) {
    console.error("Error getting game suggestion:", error)
    res.status(500).json({ error: "Failed to get game suggestion" })
  }
})

// Socket.IO for real-time communication
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id} on ${config.appId}`)

  socket.on("join-room", async (data) => {
    const { roomId, userId, userPing } = data

    socket.join(roomId)
    userPings.set(socket.id, { userId, roomId, ping: userPing })

    // Update room ping average
    await updateRoomPingAverage(roomId)

    socket.to(roomId).emit("user-joined", {
      userId,
      message: `${userId} joined the room`,
      timestamp: new Date().toISOString(),
    })
  })

  socket.on("chat-message", (data) => {
    const { roomId, message, userId } = data

    io.to(roomId).emit("chat-message", {
      userId,
      message,
      timestamp: new Date().toISOString(),
      appInstance: config.appId,
    })
  })

  socket.on("ping-update", async (data) => {
    const { ping } = data
    const userInfo = userPings.get(socket.id)

    if (userInfo) {
      userInfo.ping = ping
      await updateRoomPingAverage(userInfo.roomId)
    }
  })

  socket.on("disconnect", async () => {
    const userInfo = userPings.get(socket.id)
    if (userInfo) {
      socket.to(userInfo.roomId).emit("user-left", {
        userId: userInfo.userId,
        message: `${userInfo.userId} left the room`,
        timestamp: new Date().toISOString(),
      })

      userPings.delete(socket.id)
      await updateRoomPingAverage(userInfo.roomId)
    }
    console.log(`User disconnected: ${socket.id}`)
  })
})

async function updateRoomPingAverage(roomId) {
  const roomUsers = Array.from(userPings.values()).filter((user) => user.roomId === roomId)

  if (roomUsers.length === 0) return

  const avgPing = roomUsers.reduce((sum, user) => sum + user.ping, 0) / roomUsers.length
  await roomManager.updateRoomPing(roomId, Math.round(avgPing))
}

// Ping monitoring every 10 seconds
setInterval(async () => {
  for (const [roomId, room] of localRooms) {
    const roomUsers = Array.from(userPings.values()).filter((user) => user.roomId === roomId)

    if (roomUsers.length > 0) {
      const avgPing = roomUsers.reduce((sum, user) => sum + user.ping, 0) / roomUsers.length
      await roomManager.updateRoomPing(roomId, Math.round(avgPing))
    }
  }
}, 10000)

// Error handling
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error)
})

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason)
})

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully")
  server.close(() => {
    redis.disconnect()
    process.exit(0)
  })
})

server.listen(config.port, () => {
  console.log(`Game Room Server (${config.appId}) running on port ${config.port}`)
})

module.exports = { app, server }
