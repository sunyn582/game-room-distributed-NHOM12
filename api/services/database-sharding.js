
const { InfluxDB, Point } = require("@influxdata/influxdb-client")

class DatabaseSharding {
  constructor() {
    // Tạo multiple InfluxDB connections cho sharding
    this.shards = [
      new InfluxDB({
        url: process.env.INFLUXDB_URL_1 || "http://localhost:8086",
        token: process.env.INFLUXDB_TOKEN,
      }),
      new InfluxDB({
        url: process.env.INFLUXDB_URL_2 || "http://localhost:8087",
        token: process.env.INFLUXDB_TOKEN,
      }),
      new InfluxDB({
        url: process.env.INFLUXDB_URL_3 || "http://localhost:8088",
        token: process.env.INFLUXDB_TOKEN,
      }),
    ]

    this.shardCount = this.shards.length
    this.org = process.env.INFLUXDB_ORG || "gameroom"
    this.bucket = process.env.INFLUXDB_BUCKET || "gameroom_data"
  }

  // Hash function để phân phối data
  hashFunction(key) {
    let hash = 0
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }

  // Lấy shard index cho room
  getShardForRoom(roomId) {
    return this.hashFunction(roomId) % this.shardCount
  }

  // Lấy shard index cho user
  getShardForUser(userId) {
    return this.hashFunction(userId) % this.shardCount
  }

  // Write data to appropriate shard
  async writeRoomData(roomId, data) {
    const shardIndex = this.getShardForRoom(roomId)
    const writeApi = this.shards[shardIndex].getWriteApi(this.org, this.bucket)

    const point = new Point("room_data")
      .tag("room_id", roomId)
      .tag("shard", shardIndex.toString())
      .stringField("data", JSON.stringify(data))
      .timestamp(new Date())

    writeApi.writePoint(point)
    await writeApi.close()

    console.log(`Room ${roomId} data written to shard ${shardIndex}`)
  }

  // Write user activity to appropriate shard
  async writeUserActivity(userId, activity) {
    const shardIndex = this.getShardForUser(userId)
    const writeApi = this.shards[shardIndex].getWriteApi(this.org, this.bucket)

    const point = new Point("user_activity")
      .tag("user_id", userId)
      .tag("shard", shardIndex.toString())
      .stringField("activity", activity.type)
      .stringField("details", JSON.stringify(activity))
      .timestamp(new Date())

    writeApi.writePoint(point)
    await writeApi.close()

    console.log(`User ${userId} activity written to shard ${shardIndex}`)
  }

  // Query data from specific shard
  async queryRoomData(roomId, timeRange = "1h") {
    const shardIndex = this.getShardForRoom(roomId)
    const queryApi = this.shards[shardIndex].getQueryApi(this.org)

    const query = `
      from(bucket: "${this.bucket}")
        |> range(start: -${timeRange})
        |> filter(fn: (r) => r._measurement == "room_data")
        |> filter(fn: (r) => r.room_id == "${roomId}")
    `

    return await queryApi.collectRows(query)
  }

  // Query data from all shards (for aggregated queries)
  async queryAllShards(measurement, timeRange = "1h") {
    const promises = this.shards.map(async (shard, index) => {
      const queryApi = shard.getQueryApi(this.org)
      const query = `
        from(bucket: "${this.bucket}")
          |> range(start: -${timeRange})
          |> filter(fn: (r) => r._measurement == "${measurement}")
          |> filter(fn: (r) => r.shard == "${index}")
      `

      try {
        return await queryApi.collectRows(query)
      } catch (error) {
        console.error(`Error querying shard ${index}:`, error)
        return []
      }
    })

    const results = await Promise.all(promises)
    return results.flat()
  }

  // Get shard status
  async getShardStatus() {
    const status = await Promise.all(
      this.shards.map(async (shard, index) => {
        try {
          const health = await shard.health()
          return {
            shard: index,
            status: health.status,
            url: shard.url,
          }
        } catch (error) {
          return {
            shard: index,
            status: "error",
            error: error.message,
            url: shard.url,
          }
        }
      }),
    )

    return status
  }
}

module.exports = DatabaseSharding
