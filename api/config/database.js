const { InfluxDB, Point } = require("@influxdata/influxdb-client")
const Redis = require("ioredis")

// InfluxDB Configuration
const influxConfig = {
  url: process.env.INFLUXDB_URL || "http://localhost:8086",
  token: process.env.INFLUXDB_TOKEN || "your-token-here",
  org: process.env.INFLUXDB_ORG || "gameroom-org",
  bucket: process.env.INFLUXDB_BUCKET || "gameroom-bucket",
}

// Redis Configuration
const redisConfig = {
  host: process.env.REDIS_HOST || "localhost",
  port: process.env.REDIS_PORT || 6379,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
}

// Initialize InfluxDB
const influxDB = new InfluxDB({
  url: influxConfig.url,
  token: influxConfig.token,
})

const writeApi = influxDB.getWriteApi(influxConfig.org, influxConfig.bucket)
const queryApi = influxDB.getQueryApi(influxConfig.org)

// Initialize Redis
const redis = new Redis(redisConfig)
const subscriber = new Redis(redisConfig)

// Redis connection events
redis.on("connect", () => {
  console.log("✅ Redis connected successfully")
})

redis.on("error", (err) => {
  console.error("❌ Redis connection error:", err)
})

// InfluxDB helper functions
const influxHelpers = {
  // Write data point to InfluxDB
  async writePoint(measurement, tags = {}, fields = {}, timestamp = new Date()) {
    try {
      const point = new Point(measurement)

      // Add tags
      Object.entries(tags).forEach(([key, value]) => {
        point.tag(key, String(value))
      })

      // Add fields
      Object.entries(fields).forEach(([key, value]) => {
        if (typeof value === "number") {
          if (Number.isInteger(value)) {
            point.intField(key, value)
          } else {
            point.floatField(key, value)
          }
        } else {
          point.stringField(key, String(value))
        }
      })

      point.timestamp(timestamp)
      writeApi.writePoint(point)
      await writeApi.flush()

      console.log(`📊 Data written to InfluxDB: ${measurement}`)
    } catch (error) {
      console.error("❌ Error writing to InfluxDB:", error)
    }
  },

  // Query data from InfluxDB
  async query(fluxQuery) {
    try {
      const result = []
      await queryApi.queryRows(fluxQuery, {
        next(row, tableMeta) {
          const o = tableMeta.toObject(row)
          result.push(o)
        },
        error(error) {
          console.error("❌ InfluxDB query error:", error)
        },
      })
      return result
    } catch (error) {
      console.error("❌ Error querying InfluxDB:", error)
      return []
    }
  },

  // Get room statistics
  async getRoomStats(roomId, timeRange = "-1h") {
    const query = `
      from(bucket: "${influxConfig.bucket}")
        |> range(start: ${timeRange})
        |> filter(fn: (r) => r._measurement == "room_activity")
        |> filter(fn: (r) => r.room_id == "${roomId}")
        |> group(columns: ["_field"])
        |> mean()
    `
    return await this.query(query)
  },

  // Get system health metrics
  async getSystemHealth() {
    const query = `
      from(bucket: "${influxConfig.bucket}")
        |> range(start: -5m)
        |> filter(fn: (r) => r._measurement == "system_health")
        |> group(columns: ["app_instance"])
        |> last()
    `
    return await this.query(query)
  },
}

module.exports = {
  influxDB,
  writeApi,
  queryApi,
  redis,
  subscriber,
  influxHelpers,
  influxConfig,
  redisConfig,
}
