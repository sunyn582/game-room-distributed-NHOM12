const express = require("express")
const router = express.Router()
const { redis, influxDB } = require("../config/database")
const monitoringService = require("../services/monitoringService")

// GET /api/health - Health check endpoint
router.get("/", async (req, res) => {
  const startTime = Date.now()
  const health = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    appInstance: process.env.APP_ID || "unknown",
    uptime: process.uptime(),
    version: process.env.npm_package_version || "1.0.0",
    environment: process.env.NODE_ENV || "development",
    services: {},
  }

  try {
    // Check Redis connection
    try {
      await redis.ping()
      health.services.redis = { status: "healthy", responseTime: Date.now() - startTime }
    } catch (error) {
      health.services.redis = { status: "unhealthy", error: error.message }
      health.status = "degraded"
    }

    // Check InfluxDB connection
    try {
      const influxStart = Date.now()
      await influxDB.ping()
      health.services.influxdb = { status: "healthy", responseTime: Date.now() - influxStart }
    } catch (error) {
      health.services.influxdb = { status: "unhealthy", error: error.message }
      health.status = "degraded"
    }

    // Memory usage
    const memUsage = process.memoryUsage()
    health.memory = {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
      external: Math.round(memUsage.external / 1024 / 1024), // MB
      rss: Math.round(memUsage.rss / 1024 / 1024), // MB
    }

    // CPU usage
    health.cpu = process.cpuUsage()

    const statusCode = health.status === "healthy" ? 200 : 503
    res.status(statusCode).json(health)
  } catch (error) {
    console.error("❌ Health check error:", error)
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      appInstance: process.env.APP_ID || "unknown",
      error: error.message,
    })
  }
})

// GET /api/health/detailed - Detailed health check
router.get("/detailed", async (req, res) => {
  try {
    const stats = await monitoringService.getSystemStats("-1h")

    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      appInstance: process.env.APP_ID || "unknown",
      statistics: stats,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
    })
  } catch (error) {
    console.error("❌ Detailed health check error:", error)
    res.status(500).json({
      status: "error",
      timestamp: new Date().toISOString(),
      error: error.message,
    })
  }
})

module.exports = router
