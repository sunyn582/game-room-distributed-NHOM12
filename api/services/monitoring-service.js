// BƯỚC 2: Tạo Monitoring Service hoàn chỉnh
const { InfluxDB, Point } = require("@influxdata/influxdb-client")

class MonitoringService {
  constructor() {
    this.influxDB = new InfluxDB({
      url: process.env.INFLUXDB_URL || "http://localhost:8086",
      token: process.env.INFLUXDB_TOKEN,
    })

    this.org = process.env.INFLUXDB_ORG || "gameroom"
    this.bucket = process.env.INFLUXDB_BUCKET || "gameroom_data"
    this.writeApi = this.influxDB.getWriteApi(this.org, this.bucket)
    this.queryApi = this.influxDB.getQueryApi(this.org)

    // Configure write options
    this.writeApi.useDefaultTags({
      instance: process.env.INSTANCE_ID || "unknown",
      environment: process.env.NODE_ENV || "development",
    })
  }

  // Log API response metrics
  logApiMetrics(endpoint, method, responseTime, statusCode) {
    try {
      const point = new Point("api_metrics")
        .tag("endpoint", endpoint)
        .tag("method", method)
        .tag("status_code", statusCode.toString())
        .floatField("response_time", responseTime)
        .intField("request_count", 1)
        .timestamp(new Date())

      this.writeApi.writePoint(point)
    } catch (error) {
      console.error("Error logging API metrics:", error)
    }
  }

  // Log user activities
  logUserActivity(userId, action, roomId = null) {
    try {
      const point = new Point("user_activity")
        .tag("user_id", userId)
        .tag("action", action)
        .intField("count", 1)
        .timestamp(new Date())

      if (roomId) {
        point.tag("room_id", roomId)
      }

      this.writeApi.writePoint(point)
    } catch (error) {
      console.error("Error logging user activity:", error)
    }
  }

  // Log system metrics
  logSystemMetrics() {
    try {
      const usage = process.memoryUsage()
      const point = new Point("system_metrics")
        .floatField("memory_heap_used", usage.heapUsed)
        .floatField("memory_heap_total", usage.heapTotal)
        .floatField("memory_external", usage.external)
        .floatField("memory_rss", usage.rss)
        .floatField("uptime", process.uptime())
        .intField("active_handles", process._getActiveHandles().length)
        .intField("active_requests", process._getActiveRequests().length)
        .timestamp(new Date())

      this.writeApi.writePoint(point)
    } catch (error) {
      console.error("Error logging system metrics:", error)
    }
  }

  // Log room statistics
  logRoomStats(roomId, playerCount, status) {
    try {
      const point = new Point("room_stats")
        .tag("room_id", roomId)
        .tag("status", status)
        .intField("player_count", playerCount)
        .timestamp(new Date())

      this.writeApi.writePoint(point)
    } catch (error) {
      console.error("Error logging room stats:", error)
    }
  }

  // Query methods
  async getActiveUsers(timeRange = "1h") {
    try {
      const query = `
        from(bucket: "${this.bucket}")
          |> range(start: -${timeRange})
          |> filter(fn: (r) => r._measurement == "user_activity")
          |> filter(fn: (r) => r.action == "connected" or r.action == "joined_room")
          |> group(columns: ["user_id"])
          |> count()
      `

      const result = await this.queryApi.collectRows(query)
      return result.length
    } catch (error) {
      console.error("Error querying active users:", error)
      return 0
    }
  }

  async getAverageResponseTime(timeRange = "1h") {
    try {
      const query = `
        from(bucket: "${this.bucket}")
          |> range(start: -${timeRange})
          |> filter(fn: (r) => r._measurement == "api_metrics")
          |> filter(fn: (r) => r._field == "response_time")
          |> mean()
      `

      const result = await this.queryApi.collectRows(query)
      return result[0]?._value || 0
    } catch (error) {
      console.error("Error querying average response time:", error)
      return 0
    }
  }

  async getRequestCount(timeRange = "1h") {
    try {
      const query = `
        from(bucket: "${this.bucket}")
          |> range(start: -${timeRange})
          |> filter(fn: (r) => r._measurement == "api_metrics")
          |> filter(fn: (r) => r._field == "request_count")
          |> sum()
      `

      const result = await this.queryApi.collectRows(query)
      return result[0]?._value || 0
    } catch (error) {
      console.error("Error querying request count:", error)
      return 0
    }
  }

  async getErrorRate(timeRange = "1h") {
    try {
      const totalQuery = `
        from(bucket: "${this.bucket}")
          |> range(start: -${timeRange})
          |> filter(fn: (r) => r._measurement == "api_metrics")
          |> filter(fn: (r) => r._field == "request_count")
          |> sum()
      `

      const errorQuery = `
        from(bucket: "${this.bucket}")
          |> range(start: -${timeRange})
          |> filter(fn: (r) => r._measurement == "api_metrics")
          |> filter(fn: (r) => r._field == "request_count")
          |> filter(fn: (r) => r.status_code >= "400")
          |> sum()
      `

      const [totalResult, errorResult] = await Promise.all([
        this.queryApi.collectRows(totalQuery),
        this.queryApi.collectRows(errorQuery),
      ])

      const total = totalResult[0]?._value || 0
      const errors = errorResult[0]?._value || 0

      return total > 0 ? (errors / total) * 100 : 0
    } catch (error) {
      console.error("Error calculating error rate:", error)
      return 0
    }
  }

  // Close connections
  async close() {
    try {
      await this.writeApi.close()
    } catch (error) {
      console.error("Error closing monitoring service:", error)
    }
  }
}

module.exports = MonitoringService
