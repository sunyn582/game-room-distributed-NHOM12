const InfluxDBService = require("./influxdb")

class DashboardService {
  constructor() {
    this.influxService = new InfluxDBService()
  }

  // Lấy thống kê tổng quan cho nhóm 12
  async getNhom12Stats(timeRange = "1h") {
    try {
      const query = `
        from(bucket: "wed-game")
        |> range(start: -${timeRange})
        |> filter(fn: (r) => r._measurement == "room_creation" or r._measurement == "room_join" or r._measurement == "room_ping")
        |> group(columns: ["_measurement"])
        |> count()
      `

      const result = {}
      return new Promise((resolve, reject) => {
        this.influxService.queryApi.queryRows(query, {
          next(row, tableMeta) {
            const o = tableMeta.toObject(row)
            result[o._measurement] = o._value
          },
          error(error) {
            reject(error)
          },
          complete() {
            resolve({
              totalRoomsCreated: result.room_creation || 0,
              totalRoomJoins: result.room_join || 0,
              totalPingMeasurements: result.room_ping || 0,
              timeRange: timeRange,
              organization: "nhom_12",
              bucket: "wed-game",
            })
          },
        })
      })
    } catch (error) {
      console.error("Error getting nhom_12 stats:", error)
      throw error
    }
  }

  // Lấy top phòng có ping tốt nhất
  async getTopRoomsByPing(limit = 5) {
    try {
      const query = `
        from(bucket: "wed-game")
        |> range(start: -1h)
        |> filter(fn: (r) => r._measurement == "room_ping")
        |> filter(fn: (r) => r._field == "average_ping_ms")
        |> group(columns: ["room_id"])
        |> mean()
        |> sort(columns: ["_value"])
        |> limit(n: ${limit})
      `

      const result = []
      return new Promise((resolve, reject) => {
        this.influxService.queryApi.queryRows(query, {
          next(row, tableMeta) {
            const o = tableMeta.toObject(row)
            result.push({
              roomId: o.room_id,
              averagePing: Math.round(o._value),
              status: o._value < 50 ? "Tuyệt vời" : o._value < 100 ? "Tốt" : "Trung bình",
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
    } catch (error) {
      console.error("Error getting top rooms:", error)
      throw error
    }
  }

  // Lấy thống kê theo instance
  async getInstanceStats() {
    try {
      const query = `
        from(bucket: "wed-game")
        |> range(start: -1h)
        |> filter(fn: (r) => r._measurement == "room_creation" or r._measurement == "room_join")
        |> group(columns: ["instance_id", "_measurement"])
        |> count()
      `

      const result = {}
      return new Promise((resolve, reject) => {
        this.influxService.queryApi.queryRows(query, {
          next(row, tableMeta) {
            const o = tableMeta.toObject(row)
            if (!result[o.instance_id]) {
              result[o.instance_id] = {}
            }
            result[o.instance_id][o._measurement] = o._value
          },
          error(error) {
            reject(error)
          },
          complete() {
            resolve(result)
          },
        })
      })
    } catch (error) {
      console.error("Error getting instance stats:", error)
      throw error
    }
  }
}

module.exports = DashboardService
