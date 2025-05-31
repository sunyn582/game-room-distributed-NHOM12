const InfluxDBService = require("../../db/influxdb") // File hiện tại
const MonitoringService = require("./monitoring-service") // File mới

class ServiceManager {
  constructor() {
    // Game data service (existing)
    this.gameDB = new InfluxDBService()

    // Monitoring service (new)
    this.monitoring = new MonitoringService()
  }

  // Game-related operations
  async saveGameData(roomId, gameData) {
    return await this.gameDB.writeGameData(roomId, gameData)
  }

  async getGameHistory(roomId) {
    return await this.gameDB.getGameHistory(roomId)
  }

  // Monitoring operations
  async logApiCall(endpoint, method, responseTime, statusCode) {
    return await this.monitoring.logApiMetrics(endpoint, method, responseTime, statusCode)
  }

  async logUserAction(userId, action, roomId) {
    return await this.monitoring.logUserActivity(userId, action, roomId)
  }

  async getSystemStats() {
    return await this.monitoring.getMonitoringStats()
  }

  // Combined operations
  async saveGameDataWithMonitoring(roomId, gameData, userId) {
    // Save game data
    await this.saveGameData(roomId, gameData)

    // Log monitoring data
    await this.logUserAction(userId, "game_data_saved", roomId)
  }
}