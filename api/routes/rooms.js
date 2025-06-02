const express = require("express")
const router = express.Router()
const roomService = require("../services/roomService")
const { apiMonitoring, rateLimit } = require("../middleware/monitoring")

// Apply middleware
router.use(apiMonitoring)
router.use(rateLimit(50, 60000)) // 50 requests per minute

// GET /api/rooms - Get all rooms
router.get("/", async (req, res) => {
  try {
    const rooms = await roomService.getAllRooms()
    res.json({
      success: true,
      data: rooms,
      count: rooms.length,
      appInstance: process.env.APP_ID || "unknown",
    })
  } catch (error) {
    console.error("❌ Error getting rooms:", error)
    res.status(500).json({
      success: false,
      error: "Failed to get rooms",
      message: error.message,
    })
  }
})

// POST /api/rooms - Create new room
router.post("/", async (req, res) => {
  try {
    const { roomName } = req.body
    const creatorId = req.headers["x-user-id"] || `user_${Date.now()}`

    // Validation
    if (!roomName || roomName.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Room name is required",
      })
    }

    if (roomName.length > 50) {
      return res.status(400).json({
        success: false,
        error: "Room name must be less than 50 characters",
      })
    }

    const room = await roomService.createRoom(roomName.trim(), creatorId)

    res.status(201).json({
      success: true,
      data: room,
      message: "Room created successfully",
    })
  } catch (error) {
    console.error("❌ Error creating room:", error)
    res.status(500).json({
      success: false,
      error: "Failed to create room",
      message: error.message,
    })
  }
})

// GET /api/rooms/:roomId - Get specific room
router.get("/:roomId", async (req, res) => {
  try {
    const { roomId } = req.params
    const room = await roomService.getRoomById(roomId)

    if (!room) {
      return res.status(404).json({
        success: false,
        error: "Room not found",
      })
    }

    res.json({
      success: true,
      data: room,
    })
  } catch (error) {
    console.error("❌ Error getting room:", error)
    res.status(500).json({
      success: false,
      error: "Failed to get room",
      message: error.message,
    })
  }
})

// POST /api/rooms/:roomId/join - Join room
router.post("/:roomId/join", async (req, res) => {
  try {
    const { roomId } = req.params
    const { userPing = 0 } = req.body
    const userId = req.headers["x-user-id"] || `user_${Date.now()}`

    const room = await roomService.joinRoom(roomId, userId, userPing)

    if (!room) {
      return res.status(404).json({
        success: false,
        error: "Room not found",
      })
    }

    res.json({
      success: true,
      data: room,
      message: "Joined room successfully",
    })
  } catch (error) {
    console.error("❌ Error joining room:", error)
    res.status(500).json({
      success: false,
      error: "Failed to join room",
      message: error.message,
    })
  }
})

// POST /api/rooms/:roomId/leave - Leave room
router.post("/:roomId/leave", async (req, res) => {
  try {
    const { roomId } = req.params
    const userId = req.headers["x-user-id"] || `user_${Date.now()}`

    const success = await roomService.leaveRoom(roomId, userId)

    if (!success) {
      return res.status(404).json({
        success: false,
        error: "Room not found or user not in room",
      })
    }

    res.json({
      success: true,
      message: "Left room successfully",
    })
  } catch (error) {
    console.error("❌ Error leaving room:", error)
    res.status(500).json({
      success: false,
      error: "Failed to leave room",
      message: error.message,
    })
  }
})

// PUT /api/rooms/:roomId/ping - Update room ping
router.put("/:roomId/ping", async (req, res) => {
  try {
    const { roomId } = req.params
    const { ping } = req.body
    const userId = req.headers["x-user-id"] || `user_${Date.now()}`

    if (typeof ping !== "number" || ping < 0) {
      return res.status(400).json({
        success: false,
        error: "Valid ping value is required",
      })
    }

    const success = await roomService.updateRoomPing(roomId, ping, userId)

    if (!success) {
      return res.status(404).json({
        success: false,
        error: "Room not found",
      })
    }

    res.json({
      success: true,
      message: "Ping updated successfully",
    })
  } catch (error) {
    console.error("❌ Error updating ping:", error)
    res.status(500).json({
      success: false,
      error: "Failed to update ping",
      message: error.message,
    })
  }
})

// GET /api/rooms/:roomId/suggestion - Get game suggestion
router.get("/:roomId/suggestion", async (req, res) => {
  try {
    const { roomId } = req.params
    const room = await roomService.getRoomById(roomId)

    if (!room) {
      return res.status(404).json({
        success: false,
        error: "Room not found",
      })
    }

    const suggestion = roomService.getGameSuggestion(room.avgPing)

    res.json({
      success: true,
      data: {
        ...suggestion,
        roomPing: room.avgPing,
        roomId: roomId,
      },
    })
  } catch (error) {
    console.error("❌ Error getting game suggestion:", error)
    res.status(500).json({
      success: false,
      error: "Failed to get game suggestion",
      message: error.message,
    })
  }
})

module.exports = router
