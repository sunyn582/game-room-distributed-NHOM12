const { influxHelpers } = require("../config/database")

class MonitoringService {
  constructor() {
    this.appId = process.env.APP_ID || "app1"
    this.startHealthMonitoring()
  }

  // Start periodic health monitoring
  startHealthMonitoring() {
    // Log system health every 30 seconds
    setInterval(async () => {
      await this.logSystemHealth()
    }, 30000)

    console.log("📊 Health monitoring started")
  }

  // Log system health metrics
  async logSystemHealth() {
    try {
      const healthData = {
        uptime: process.uptime(),
        memory_usage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
        cpu_usage: process.cpuUsage(),
        timestamp: new Date().toISOString(),
      }

      await influxHelpers.writePoint(
        "system_health",
        {
          app_instance: this.appId,
          node_env: process.env.NODE_ENV || "development",
        },
        {
          uptime: healthData.uptime,
          memory_usage_mb: healthData.memory_usage,
          cpu_user: healthData.cpu_usage.user,
          cpu_system: healthData.cpu_usage.system,
        },
      )
    } catch (error) {
      console.error("❌ Error logging system health:", error)
    }
  }

  // Log API request metrics
  async logApiRequest(endpoint, method, responseTime, statusCode, userId = null) {
    try {
      await influxHelpers.writePoint(
        "api_request",
        {
          endpoint,
          method,
          status_code: String(statusCode),
          app_instance: this.appId,
          user_id: userId || "anonymous",
        },
        {
          response_time_ms: responseTime,
          request_count: 1,
        },
      )
    } catch (error) {
      console.error("❌ Error logging API request:", error)
    }
  }

  // Log chat activity
  async logChatActivity(roomId, userId, messageLength) {
    try {
      await influxHelpers.writePoint(
        "chat_activity",
        {
          room_id: roomId,
          user_id: userId,
          app_instance: this.appId,
        },
        {
          message_length: messageLength,
          message_count: 1,
        },
      )
    } catch (error) {
      console.error("❌ Error logging chat activity:", error)
    }
  }

  // Get system statistics
  async getSystemStats(timeRange = "-1h") {
    try {
      const stats = {
        totalRooms: await this.getTotalRooms(timeRange),
        totalUsers: await this.getTotalUsers(timeRange),
        avgPing: await this.getAveragePing(timeRange),
        apiRequests: await this.getApiRequestCount(timeRange),
        systemHealth: await influxHelpers.getSystemHealth(),
      }

      return stats
    } catch (error) {
      console.error("❌ Error getting system stats:", error)
      return {}
    }
  }

  async getTotalRooms(timeRange) {
    const query = `
      from(bucket: "${require("../config/database").influxConfig.bucket}")
        |> range(start: ${timeRange})
        |> filter(fn: (r) => r._measurement == "room_created")
        |> count()
        |> yield(name: "total_rooms")
    `
    const result = await influxHelpers.query(query)
    return result.length > 0 ? result[0]._value : 0
  }

  async getTotalUsers(timeRange) {
    const query = `
      from(bucket: "${require("../config/database").influxConfig.bucket}")
        |> range(start: ${timeRange})
        |> filter(fn: (r) => r._measurement == "user_joined")
        |> group(columns: ["user_id"])
        |> count()
        |> group()
        |> count()
        |> yield(name: "unique_users")
    `
    const result = await influxHelpers.query(query)
    return result.length > 0 ? result[0]._value : 0
  }

  async getAveragePing(timeRange) {
    const query = `
      from(bucket: "${require("../config/database").influxConfig.bucket}")
        |> range(start: ${timeRange})
        |> filter(fn: (r) => r._measurement == "ping_update")
        |> filter(fn: (r) => r._field == "avg_ping")
        |> mean()
        |> yield(name: "avg_ping")
    `
    const result = await influxHelpers.query(query)
    return result.length > 0 ? Math.round(result[0]._value) : 0
  }

  async getApiRequestCount(timeRange) {
    const query = `
      from(bucket: "${require("../config/database").influxConfig.bucket}")
        |> range(start: ${timeRange})
        |> filter(fn: (r) => r._measurement == "api_request")
        |> count()
        |> yield(name: "api_requests")
    `
    const result = await influxHelpers.query(query)
    return result.length > 0 ? result[0]._value : 0
  }
}

module.exports = new MonitoringService()
