const { redis, influxHelpers } = require("../config/database")
const { v4: uuidv4 } = require("uuid")

class RoomService {
  constructor() {
    this.appId = process.env.APP_ID || "app1"
    this.setupRedisSubscriptions()
  }

  // Setup Redis pub/sub for distributed communication
  setupRedisSubscriptions() {
    const { subscriber } = require("../config/database")

    subscriber.subscribe("room:created", "room:updated", "room:deleted", "room:ping_update")

    subscriber.on("message", (channel, message) => {
      try {
        const data = JSON.parse(message)
        this.handleDistributedEvent(channel, data)
      } catch (error) {
        console.error("❌ Error handling distributed event:", error)
      }
    })
  }

  handleDistributedEvent(channel, data) {
    console.log(`📡 Received distributed event: ${channel}`, data)

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
      case "room:ping_update":
        this.syncPingUpdate(data)
        break
    }
  }

  // Generate unique room ID
  generateRoomId() {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substr(2, 9)
    return `room_${timestamp}_${random}`
  }

  // Create new room
  async createRoom(roomName, creatorId) {
    try {
      const roomId = this.generateRoomId()
      const room = {
        id: roomId,
        name: roomName,
        createdAt: new Date().toISOString(),
        createdBy: creatorId,
        members: [creatorId],
        avgPing: 0,
        memberCount: 1,
        appInstance: this.appId,
        status: "active",
      }

      // Store in Redis
      await redis.hset(`room:${roomId}`, room)
      await redis.sadd("rooms:active", roomId)
      await redis.expire(`room:${roomId}`, 86400) // 24 hours TTL

      // Publish to other instances
      await redis.publish("room:created", JSON.stringify(room))

      // Log to InfluxDB
      await influxHelpers.writePoint(
        "room_created",
        {
          room_id: roomId,
          app_instance: this.appId,
          creator_id: creatorId,
        },
        {
          member_count: 1,
          avg_ping: 0,
          room_name: roomName,
        },
      )

      console.log(`🏠 Room created: ${roomId} by ${creatorId}`)
      return room
    } catch (error) {
      console.error("❌ Error creating room:", error)
      throw error
    }
  }

  // Get all active rooms
  async getAllRooms() {
    try {
      const roomIds = await redis.smembers("rooms:active")
      const rooms = []

      for (const roomId of roomIds) {
        const roomData = await redis.hgetall(`room:${roomId}`)
        if (roomData && Object.keys(roomData).length > 0) {
          // Convert string values back to appropriate types
          roomData.members = JSON.parse(roomData.members || "[]")
          roomData.avgPing = Number.parseFloat(roomData.avgPing || 0)
          roomData.memberCount = Number.parseInt(roomData.memberCount || 0)
          rooms.push(roomData)
        }
      }

      return rooms.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    } catch (error) {
      console.error("❌ Error getting rooms:", error)
      return []
    }
  }

  // Get room by ID
  async getRoomById(roomId) {
    try {
      const roomData = await redis.hgetall(`room:${roomId}`)
      if (roomData && Object.keys(roomData).length > 0) {
        roomData.members = JSON.parse(roomData.members || "[]")
        roomData.avgPing = Number.parseFloat(roomData.avgPing || 0)
        roomData.memberCount = Number.parseInt(roomData.memberCount || 0)
        return roomData
      }
      return null
    } catch (error) {
      console.error("❌ Error getting room:", error)
      return null
    }
  }

  // Update room ping
  async updateRoomPing(roomId, newPing, userId) {
    try {
      const room = await this.getRoomById(roomId)
      if (!room) return false

      // Update room data
      room.avgPing = newPing
      room.lastPingUpdate = new Date().toISOString()

      // Store updated data
      await redis.hset(`room:${roomId}`, {
        avgPing: newPing,
        lastPingUpdate: room.lastPingUpdate,
      })

      // Publish update to other instances
      await redis.publish(
        "room:ping_update",
        JSON.stringify({
          roomId,
          avgPing: newPing,
          userId,
          timestamp: room.lastPingUpdate,
        }),
      )

      // Log to InfluxDB
      await influxHelpers.writePoint(
        "ping_update",
        {
          room_id: roomId,
          user_id: userId,
          app_instance: this.appId,
        },
        {
          avg_ping: newPing,
          member_count: room.memberCount,
        },
      )

      return true
    } catch (error) {
      console.error("❌ Error updating room ping:", error)
      return false
    }
  }

  // Join room
  async joinRoom(roomId, userId, userPing = 0) {
    try {
      const room = await this.getRoomById(roomId)
      if (!room) return false

      // Add user to members if not already present
      if (!room.members.includes(userId)) {
        room.members.push(userId)
        room.memberCount = room.members.length

        // Update Redis
        await redis.hset(`room:${roomId}`, {
          members: JSON.stringify(room.members),
          memberCount: room.memberCount,
        })

        // Log to InfluxDB
        await influxHelpers.writePoint(
          "user_joined",
          {
            room_id: roomId,
            user_id: userId,
            app_instance: this.appId,
          },
          {
            member_count: room.memberCount,
            user_ping: userPing,
          },
        )
      }

      return room
    } catch (error) {
      console.error("❌ Error joining room:", error)
      return false
    }
  }

  // Leave room
  async leaveRoom(roomId, userId) {
    try {
      const room = await this.getRoomById(roomId)
      if (!room) return false

      // Remove user from members
      room.members = room.members.filter((id) => id !== userId)
      room.memberCount = room.members.length

      if (room.memberCount === 0) {
        // Delete empty room
        await redis.del(`room:${roomId}`)
        await redis.srem("rooms:active", roomId)
        await redis.publish("room:deleted", JSON.stringify({ roomId }))
      } else {
        // Update room
        await redis.hset(`room:${roomId}`, {
          members: JSON.stringify(room.members),
          memberCount: room.memberCount,
        })
      }

      // Log to InfluxDB
      await influxHelpers.writePoint(
        "user_left",
        {
          room_id: roomId,
          user_id: userId,
          app_instance: this.appId,
        },
        {
          member_count: room.memberCount,
        },
      )

      return true
    } catch (error) {
      console.error("❌ Error leaving room:", error)
      return false
    }
  }

  // Get game suggestion based on ping
  getGameSuggestion(avgPing) {
    if (avgPing < 50) {
      return {
        category: "Competitive",
        games: ["Counter-Strike 2", "Valorant", "League of Legends", "Rocket League"],
        reason: "Ping thấp - hoàn hảo cho game cạnh tranh!",
        pingRange: "< 50ms",
        color: "#48bb78",
      }
    } else if (avgPing < 100) {
      return {
        category: "Action",
        games: ["Fortnite", "Apex Legends", "Call of Duty", "Overwatch 2"],
        reason: "Ping tốt - phù hợp cho game hành động",
        pingRange: "50-100ms",
        color: "#38b2ac",
      }
    } else if (avgPing < 150) {
      return {
        category: "Strategy",
        games: ["Civilization VI", "Age of Empires IV", "StarCraft II", "Chess.com"],
        reason: "Ping trung bình - game chiến thuật hoạt động tốt",
        pingRange: "100-150ms",
        color: "#ed8936",
      }
    } else {
      return {
        category: "Turn-based",
        games: ["Hearthstone", "Gwent", "Auto Chess", "Board Game Arena"],
        reason: "Ping cao - khuyến nghị game lượt chơi",
        pingRange: "> 150ms",
        color: "#f56565",
      }
    }
  }

  // Sync methods for distributed events
  syncRoomCreated(room) {
    console.log(`🔄 Syncing room created: ${room.id}`)
  }

  syncRoomUpdated(room) {
    console.log(`🔄 Syncing room updated: ${room.id}`)
  }

  syncRoomDeleted(data) {
    console.log(`🔄 Syncing room deleted: ${data.roomId}`)
  }

  syncPingUpdate(data) {
    console.log(`🔄 Syncing ping update for room: ${data.roomId}`)
  }
}

module.exports = new RoomService()
