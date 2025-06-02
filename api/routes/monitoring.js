const express = require("express")
const router = express.Router()
const monitoringService = require("../services/monitoringService")
const { influxHelpers } = require("../config/database")

// GET /api/monitoring/stats - Get system statistics
router.get("/stats", async (req, res) => {
  try {
    const timeRange = req.query.range || "-1h"
    const stats = await monitoringService.getSystemStats(timeRange)

    res.json({
      success: true,
      data: stats,
      timeRange,
      appInstance: process.env.APP_ID || "unknown",
    })
  } catch (error) {
    console.error("❌ Error getting stats:", error)
    res.status(500).json({
      success: false,
      error: "Failed to get statistics",
      message: error.message,
    })
  }
})

// GET /api/monitoring/rooms/:roomId/stats - Get room statistics
router.get("/rooms/:roomId/stats", async (req, res) => {
  try {
    const { roomId } = req.params
    const timeRange = req.query.range || "-1h"

    const stats = await influxHelpers.getRoomStats(roomId, timeRange)

    res.json({
      success: true,
      data: stats,
      roomId,
      timeRange,
    })
  } catch (error) {
    console.error("❌ Error getting room stats:", error)
    res.status(500).json({
      success: false,
      error: "Failed to get room statistics",
      message: error.message,
    })
  }
})

// GET /api/monitoring/ping-history/:roomId - Get ping history for room
router.get("/ping-history/:roomId", async (req, res) => {
  try {
    const { roomId } = req.params
    const timeRange = req.query.range || "-1h"

    const query = `
      from(bucket: "${require("../config/database").influxConfig.bucket}")
        |> range(start: ${timeRange})
        |> filter(fn: (r) => r._measurement == "ping_update")
        |> filter(fn: (r) => r.room_id == "${roomId}")
        |> filter(fn: (r) => r._field == "avg_ping")
        |> sort(columns: ["_time"])
    `

    const pingHistory = await influxHelpers.query(query)

    res.json({
      success: true,
      data: pingHistory,
      roomId,
      timeRange,
    })
  } catch (error) {
    console.error("❌ Error getting ping history:", error)
    res.status(500).json({
      success: false,
      error: "Failed to get ping history",
      message: error.message,
    })
  }
})

// GET /api/monitoring/system-health - Get system health metrics
router.get("/system-health", async (req, res) => {
  try {
    const timeRange = req.query.range || "-5m"

    const healthMetrics = await influxHelpers.getSystemHealth()

    res.json({
      success: true,
      data: healthMetrics,
      timeRange,
      appInstance: process.env.APP_ID || "unknown",
    })
  } catch (error) {
    console.error("❌ Error getting system health:", error)
    res.status(500).json({
      success: false,
      error: "Failed to get system health",
      message: error.message,
    })
  }
})

module.exports = router
