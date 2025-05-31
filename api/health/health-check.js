
const express = require("express")
const redis = require("redis")

class HealthChecker {
  constructor() {
    this.checks = new Map()
    this.setupChecks()
  }

  setupChecks() {
    // Database health check
    this.checks.set("database", async () => {
      try {
        // Kiểm tra InfluxDB connection
        const start = Date.now()
        const response = await fetch(process.env.INFLUXDB_URL + "/health")
        return {
          status: response.ok ? "healthy" : "unhealthy",
          latency: Date.now() - start,
          details: response.ok ? "Connected" : "Connection failed",
        }
      } catch (error) {
        return {
          status: "unhealthy",
          details: error.message,
        }
      }
    })

    // Redis health check
    this.checks.set("redis", async () => {
      try {
        const client = redis.createClient({
          url: process.env.REDIS_URL || "redis://localhost:6379",
        })
        await client.connect()
        await client.ping()
        await client.disconnect()

        return {
          status: "healthy",
          details: "Redis connection successful",
        }
      } catch (error) {
        return {
          status: "unhealthy",
          details: error.message,
        }
      }
    })

    // Memory health check
    this.checks.set("memory", async () => {
      const usage = process.memoryUsage()
      const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024)
      const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024)

      return {
        status: heapUsedMB < 500 ? "healthy" : "warning",
        details: `${heapUsedMB}MB / ${heapTotalMB}MB`,
        heapUsed: heapUsedMB,
        heapTotal: heapTotalMB,
      }
    })
  }

  async runAllChecks() {
    const results = {}
    const start = Date.now()

    for (const [name, checkFn] of this.checks) {
      try {
        results[name] = await checkFn()
      } catch (error) {
        results[name] = {
          status: "error",
          details: error.message,
        }
      }
    }

    const overallStatus = Object.values(results).every((r) => r.status === "healthy") ? "healthy" : "unhealthy"

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: results,
      responseTime: Date.now() - start,
    }
  }
}

module.exports = HealthChecker
