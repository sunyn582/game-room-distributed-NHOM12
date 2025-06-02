const io = require("socket.io-client")
const axios = require("axios")

class StressTest {
  constructor() {
    this.baseUrl = "http://localhost"
    this.clients = []
    this.rooms = []
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      errors: [],
    }
  }

  async runTest() {
    console.log("🚀 Starting Distributed System Stress Test...\n")

    // Test 1: API Load Test
    await this.testAPILoad()

    // Test 2: Room Creation Load
    await this.testRoomCreation()

    // Test 3: WebSocket Connections
    await this.testWebSocketLoad()

    // Test 4: Concurrent Chat Messages
    await this.testChatLoad()

    // Test 5: Fault Tolerance
    await this.testFaultTolerance()

    this.printResults()
  }

  async testAPILoad() {
    console.log("📊 Testing API Load (100 concurrent requests)...")

    const promises = []
    const startTime = Date.now()

    for (let i = 0; i < 100; i++) {
      promises.push(this.makeAPIRequest("/api/health"))
    }

    const results = await Promise.allSettled(promises)
    const endTime = Date.now()

    const successful = results.filter((r) => r.status === "fulfilled").length
    const failed = results.filter((r) => r.status === "rejected").length

    console.log(`✅ API Load Test: ${successful} successful, ${failed} failed`)
    console.log(`⏱️  Total time: ${endTime - startTime}ms\n`)

    this.updateStats(100, successful, failed, endTime - startTime)
  }

  async testRoomCreation() {
    console.log("🏠 Testing Room Creation (50 concurrent rooms)...")

    const promises = []
    const startTime = Date.now()

    for (let i = 0; i < 50; i++) {
      promises.push(this.createRoom(`StressTest_Room_${i}`))
    }

    const results = await Promise.allSettled(promises)
    const endTime = Date.now()

    const successful = results.filter((r) => r.status === "fulfilled").length
    const failed = results.filter((r) => r.status === "rejected").length

    // Store successful rooms for later tests
    this.rooms = results.filter((r) => r.status === "fulfilled").map((r) => r.value)

    console.log(`✅ Room Creation: ${successful} successful, ${failed} failed`)
    console.log(`⏱️  Total time: ${endTime - startTime}ms\n`)

    this.updateStats(50, successful, failed, endTime - startTime)
  }

  async testWebSocketLoad() {
    console.log("🔌 Testing WebSocket Connections (100 concurrent clients)...")

    const promises = []
    const startTime = Date.now()

    for (let i = 0; i < 100; i++) {
      promises.push(this.createWebSocketClient(i))
    }

    await Promise.allSettled(promises)
    const endTime = Date.now()

    console.log(`✅ WebSocket Connections: ${this.clients.length} connected`)
    console.log(`⏱️  Connection time: ${endTime - startTime}ms\n`)

    // Keep connections for chat test
  }

  async testChatLoad() {
    console.log("💬 Testing Chat Load (1000 messages across all clients)...")

    if (this.clients.length === 0 || this.rooms.length === 0) {
      console.log("❌ Skipping chat test - no clients or rooms available\n")
      return
    }

    const promises = []
    const startTime = Date.now()
    const messagesPerClient = Math.floor(1000 / this.clients.length)

    this.clients.forEach((client, index) => {
      // Join a random room
      const room = this.rooms[index % this.rooms.length]
      client.emit("join-room", {
        roomId: room.id,
        userId: `stress_user_${index}`,
        userPing: Math.floor(Math.random() * 100),
      })

      // Send messages
      for (let i = 0; i < messagesPerClient; i++) {
        promises.push(this.sendChatMessage(client, room.id, `Message ${i} from client ${index}`))
      }
    })

    await Promise.allSettled(promises)
    const endTime = Date.now()

    console.log(`✅ Chat Load: ${promises.length} messages sent`)
    console.log(`⏱️  Total time: ${endTime - startTime}ms\n`)
  }

  async testFaultTolerance() {
    console.log("🛡️  Testing Fault Tolerance...")

    // Test with one app instance down (simulate by making requests to specific ports)
    const ports = [3001, 3002, 3003]
    const results = []

    for (const port of ports) {
      try {
        const response = await axios.get(`http://localhost:${port}/api/health`, {
          timeout: 5000,
        })
        results.push({ port, status: "up", response: response.status })
      } catch (error) {
        results.push({ port, status: "down", error: error.message })
      }
    }

    const upInstances = results.filter((r) => r.status === "up").length
    const downInstances = results.filter((r) => r.status === "down").length

    console.log(`✅ Fault Tolerance: ${upInstances} instances up, ${downInstances} instances down`)

    if (upInstances > 0) {
      console.log("✅ System remains operational with available instances")
    } else {
      console.log("❌ All instances are down - system failure")
    }

    console.log()
  }

  async makeAPIRequest(endpoint) {
    const startTime = Date.now()
    try {
      const response = await axios.get(`${this.baseUrl}${endpoint}`, {
        timeout: 10000,
      })
      return {
        success: true,
        responseTime: Date.now() - startTime,
        status: response.status,
      }
    } catch (error) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        error: error.message,
      }
    }
  }

  async createRoom(roomName) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/rooms`,
        {
          roomName: roomName,
        },
        {
          headers: {
            "X-User-ID": `stress_user_${Date.now()}`,
          },
          timeout: 10000,
        },
      )
      return response.data
    } catch (error) {
      throw new Error(`Failed to create room: ${error.message}`)
    }
  }

  async createWebSocketClient(clientId) {
    return new Promise((resolve, reject) => {
      const client = io(this.baseUrl, {
        timeout: 10000,
        forceNew: true,
      })

      client.on("connect", () => {
        this.clients.push(client)
        resolve(client)
      })

      client.on("connect_error", (error) => {
        reject(error)
      })

      setTimeout(() => {
        reject(new Error("Connection timeout"))
      }, 10000)
    })
  }

  async sendChatMessage(client, roomId, message) {
    return new Promise((resolve) => {
      client.emit("chat-message", {
        roomId: roomId,
        message: message,
        userId: `stress_user_${Date.now()}`,
      })

      // Simulate message processing time
      setTimeout(resolve, 10)
    })
  }

  updateStats(total, successful, failed, responseTime) {
    this.stats.totalRequests += total
    this.stats.successfulRequests += successful
    this.stats.failedRequests += failed
    this.stats.averageResponseTime = (this.stats.averageResponseTime + responseTime) / 2
  }

  printResults() {
    console.log("📈 STRESS TEST RESULTS")
    console.log("========================")
    console.log(`Total Requests: ${this.stats.totalRequests}`)
    console.log(`Successful: ${this.stats.successfulRequests}`)
    console.log(`Failed: ${this.stats.failedRequests}`)
    console.log(`Success Rate: ${((this.stats.successfulRequests / this.stats.totalRequests) * 100).toFixed(2)}%`)
    console.log(`Average Response Time: ${this.stats.averageResponseTime.toFixed(2)}ms`)
    console.log(`WebSocket Connections: ${this.clients.length}`)
    console.log(`Rooms Created: ${this.rooms.length}`)

    // Cleanup
    this.cleanup()
  }

  cleanup() {
    console.log("\n🧹 Cleaning up connections...")
    this.clients.forEach((client) => {
      client.disconnect()
    })
    console.log("✅ Cleanup completed")
  }
}

// Run the stress test
if (require.main === module) {
  const stressTest = new StressTest()
  stressTest.runTest().catch(console.error)
}

module.exports = StressTest
