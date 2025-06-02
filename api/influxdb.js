const { InfluxDB, Point } = require("@influxdata/influxdb-client")

class InfluxDBService {
  constructor() {
    this.url = process.env.INFLUXDB_URL || "http://influxdb:8086"
    this.token =
      process.env.INFLUXDB_TOKEN ||
      "zIGlnIr44LpdJnobJ68V8AHdzsWfaIShovlLY9m5ZDX3j_8SisNNq7BF-btVVgFuHMtlXEkswG0xoO0UoXcw4w=="
    this.org = "nhom_12"
    this.bucket = "buckets1"

    this.influxDB = new InfluxDB({ url: this.url, token: this.token })
    this.writeApi = this.influxDB.getWriteApi(this.org, this.bucket)
    this.queryApi = this.influxDB.getQueryApi(this.org)

    console.log(`InfluxDB initialized for nhom_12`)
  }

  // Ghi dữ liệu tạo phòng
  async writeRoomCreation(roomId, responseTime, instanceId) {
    const point = new Point("room_creation")
      .tag("room_id", roomId)
      .tag("instance_id", instanceId)
      .floatField("response_time_ms", responseTime)
      .timestamp(new Date())

    this.writeApi.writePoint(point)
    await this.writeApi.flush()
  }

  // Ghi dữ liệu vào phòng
  async writeRoomJoin(roomId, userId, responseTime, instanceId) {
    const point = new Point("room_join")
      .tag("room_id", roomId)
      .tag("user_id", userId)
      .tag("instance_id", instanceId)
      .floatField("response_time_ms", responseTime)
      .timestamp(new Date())

    this.writeApi.writePoint(point)
    await this.writeApi.flush()
  }

  // Ghi dữ liệu ping phòng
  async writeRoomPing(roomId, averagePing, userCount, instanceId) {
    const point = new Point("room_ping")
      .tag("room_id", roomId)
      .tag("instance_id", instanceId)
      .floatField("average_ping_ms", averagePing)
      .intField("user_count", userCount)
      .timestamp(new Date())

    this.writeApi.writePoint(point)
    await this.writeApi.flush()
  }

  // Truy vấn ping trung bình của phòng
  async getRoomPingHistory(roomId, timeRange = "1h") {
    const query = `
            from(bucket: "${this.bucket}")
            |> range(start: -${timeRange})
            |> filter(fn: (r) => r._measurement == "room_ping")
            |> filter(fn: (r) => r.room_id == "${roomId}")
            |> filter(fn: (r) => r._field == "average_ping_ms")
            |> aggregateWindow(every: 1m, fn: mean, createEmpty: false)
        `

    const result = []
    return new Promise((resolve, reject) => {
      this.queryApi.queryRows(query, {
        next(row, tableMeta) {
          const o = tableMeta.toObject(row)
          result.push({
            time: o._time,
            ping: o._value,
          })
        },
        error(error) {
          reject(error)
        },
        complete() {
          resolve(result)
        },
      })
    })
  }

  // Truy vấn thống kê phòng
  async getRoomStats(timeRange = "1h") {
    const query = `
            from(bucket: "${this.bucket}")
            |> range(start: -${timeRange})
            |> filter(fn: (r) => r._measurement == "room_creation" or r._measurement == "room_join")
            |> group(columns: ["_measurement"])
            |> count()
        `

    const result = {}
    return new Promise((resolve, reject) => {
      this.queryApi.queryRows(query, {
        next(row, tableMeta) {
          const o = tableMeta.toObject(row)
          result[o._measurement] = o._value
        },
        error(error) {
          reject(error)
        },
        complete() {
          resolve(result)
        },
      })
    })
  }
}

module.exports = InfluxDBService
