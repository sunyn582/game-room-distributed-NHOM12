
const axios = require("axios")
const WebSocket = require("ws")

class GameRoomStressTest {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || "http://localhost:3001"
    this.wsUrl = config.wsUrl || "ws://localhost:3001"
    this.results = {
      api: { requests: 0, successes: 0, failures: 0, responseTimes: [] },
      websocket: { connections: 0, successes: 0, failures: 0, messages: 0 },
      errors: [],
    }
  }

  // Test 1: API Load Test
  async testApiEndpoints(concurrentUsers = 20, requestsPerUser = 50) {
    console.log(`🔥 API Load Test: ${concurrentUsers} users × ${requestsPerUser} requests`)

    const userPromises = []
    for (let i = 0; i < concurrentUsers; i++) {
      userPromises.push(this.simulateApiUser(i, requestsPerUser))
    }

    await Promise.all(userPromises)
    this.printApiResults()
  }

  async simulateApiUser(userId, requestCount) {
    const endpoints = [
      { method: "GET", path: "/health" },
      { method: "GET", path: "/api/rooms" },
      { method: "POST", path: "/api/rooms", data: { name: `Room-${userId}`, maxPlayers: 4 } },
      { method: "GET", path: `/api/rooms/room-${userId}` },
    ]

    for (let i = 0; i < requestCount; i++) {
      const endpoint = endpoints[i % endpoints.length]
      const startTime = Date.now()

      try {
        let response
        if (endpoint.method === "GET") {
          response = await axios.get(this.baseUrl + endpoint.path)
        } else {
          response = await axios.post(this.baseUrl + endpoint.path, endpoint.data)
        }

        const responseTime = Date.now() - startTime
        this.results.api.requests++
        this.results.api.successes++
        this.results.api.responseTimes.push(responseTime)
      } catch (error) {
        this.results.api.requests++
        this.results.api.failures++
        this.results.errors.push({
          type: "API",
          endpoint: endpoint.path,
          error: error.message,
        })
      }

      // Random delay between requests
      await this.sleep(Math.random() * 100)
    }
  }

  // Test 2: WebSocket Connection Test
  async testWebSocketConnections(concurrentConnections = 50, messagesPerConnection = 20) {
    console.log(`🔌 WebSocket Test: ${concurrentConnections} connections × ${messagesPerConnection} messages`)

    const connectionPromises = []
    for (let i = 0; i < concurrentConnections; i++) {
      connectionPromises.push(this.simulateWebSocketUser(i, messagesPerConnection))
    }

    await Promise.all(connectionPromises)
    this.printWebSocketResults()
  }

  async simulateWebSocketUser(userId, messageCount) {
    return new Promise((resolve) => {
      const ws = new WebSocket(this.wsUrl)
      let sentMessages = 0
      let receivedMessages = 0

      ws.on("open", () => {
        this.results.websocket.connections++
        this.results.websocket.successes++

        // Send messages periodically
        const sendInterval = setInterval(
          () => {
            if (sentMessages >= messageCount) {
              clearInterval(sendInterval)
              setTimeout(() => ws.close(), 1000)
              return
            }

            const message = {
              type: "chat",
              userId: `stress-user-${userId}`,
              roomId: `stress-room-${userId % 10}`,
              message: `Test message ${sentMessages} from user ${userId}`,
              timestamp: Date.now(),
            }

            ws.send(JSON.stringify(message))
            sentMessages++
            this.results.websocket.messages++
          },
          500 + Math.random() * 1000,
        ) // Random interval 0.5-1.5s
      })

      ws.on("message", (data) => {
        receivedMessages++
      })

      ws.on("close", () => {
        resolve({ sent: sentMessages, received: receivedMessages })
      })

      ws.on("error", (error) => {
        this.results.websocket.failures++
        this.results.errors.push({
          type: "WebSocket",
          userId: userId,
          error: error.message,
        })
        resolve({ sent: sentMessages, received: receivedMessages })
      })

      // Timeout after 60 seconds
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close()
        }
      }, 60000)
    })
  }

  // Test 3: Database Sharding Test
  async testDatabaseSharding(roomCount = 100, usersPerRoom = 10) {
    console.log(`💾 Database Sharding Test: ${roomCount} rooms × ${usersPerRoom} users`)

    const promises = []
    for (let roomId = 0; roomId < roomCount; roomId++) {
      for (let userId = 0; userId < usersPerRoom; userId++) {
        promises.push(this.testShardWrite(roomId, userId))
      }
    }

    await Promise.all(promises)
    console.log(`✅ Database sharding test completed: ${promises.length} operations`)
  }

  async testShardWrite(roomId, userId) {
    try {
      await axios.post(`${this.baseUrl}/api/test/shard-write`, {
        roomId: `room-${roomId}`,
        userId: `user-${userId}`,
        action: "join",
        timestamp: Date.now(),
      })
    } catch (error) {
      this.results.errors.push({
        type: "Sharding",
        roomId: roomId,
        userId: userId,
        error: error.message,
      })
    }
  }

  // Test 4: Circuit Breaker Test
  async testCircuitBreaker(failureRate = 0.7, requestCount = 100) {
    console.log(`⚡ Circuit Breaker Test: ${requestCount} requests with ${failureRate * 100}% failure rate`)

    for (let i = 0; i < requestCount; i++) {
      try {
        // Simulate failures by calling a test endpoint
        await axios.get(`${this.baseUrl}/api/test/circuit-breaker?fail=${Math.random() < failureRate}`)
      } catch (error) {
        // Expected failures for circuit breaker testing
      }

      await this.sleep(100) // Small delay between requests
    }

    console.log(`✅ Circuit breaker test completed`)
  }

  // Utility methods
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  printApiResults() {
    console.log("\n📊 API TEST RESULTS:")
    console.log(`Total Requests: ${this.results.api.requests}`)
    console.log(`Successes: ${this.results.api.successes}`)
    console.log(`Failures: ${this.results.api.failures}`)
    console.log(`Success Rate: ${((this.results.api.successes / this.results.api.requests) * 100).toFixed(2)}%`)

    if (this.results.api.responseTimes.length > 0) {
      const avg = this.results.api.responseTimes.reduce((a, b) => a + b, 0) / this.results.api.responseTimes.length
      const max = Math.max(...this.results.api.responseTimes)
      const min = Math.min(...this.results.api.responseTimes)

      console.log(`Average Response Time: ${avg.toFixed(2)}ms`)
      console.log(`Max Response Time: ${max}ms`)
      console.log(`Min Response Time: ${min}ms`)
    }
  }

  printWebSocketResults() {
    console.log("\n🔌 WEBSOCKET TEST RESULTS:")
    console.log(`Total Connections: ${this.results.websocket.connections}`)
    console.log(`Successful Connections: ${this.results.websocket.successes}`)
    console.log(`Failed Connections: ${this.results.websocket.failures}`)
    console.log(`Total Messages Sent: ${this.results.websocket.messages}`)
    console.log(
      `Connection Success Rate: ${((this.results.websocket.successes / this.results.websocket.connections) * 100).toFixed(2)}%`,
    )
  }

  async runFullStressTest() {
    console.log("🚀 Starting Full Stress Test Suite...\n")

    // Test 1: API Load
    await this.testApiEndpoints(30, 50)
    await this.sleep(2000)

    // Test 2: WebSocket Load
    await this.testWebSocketConnections(40, 15)
    await this.sleep(2000)

    // Test 3: Database Sharding
    await this.testDatabaseSharding(50, 5)
    await this.sleep(2000)

    // Test 4: Circuit Breaker
    await this.testCircuitBreaker(0.6, 50)

    this.printFinalResults()
  }

  printFinalResults() {
    console.log("\n🎯 FINAL STRESS TEST SUMMARY:")
    console.log("=".repeat(50))

    const totalRequests = this.results.api.requests
    const totalSuccesses = this.results.api.successes + this.results.websocket.successes
    const totalFailures = this.results.api.failures + this.results.websocket.failures

    console.log(`Total Operations: ${totalRequests + this.results.websocket.connections}`)
    console.log(`Total Successes: ${totalSuccesses}`)
    console.log(`Total Failures: ${totalFailures}`)
    console.log(`Overall Success Rate: ${((totalSuccesses / (totalSuccesses + totalFailures)) * 100).toFixed(2)}%`)

    if (this.results.errors.length > 0) {
      console.log("\n❌ Top Errors:")
      const errorCounts = {}
      this.results.errors.forEach((error) => {
        const key = `${error.type}: ${error.error}`
        errorCounts[key] = (errorCounts[key] || 0) + 1
      })

      Object.entries(errorCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .forEach(([error, count]) => {
          console.log(`  ${error}: ${count} times`)
        })
    }

    console.log("\n✅ Stress test completed!")
  }
}

// Run stress test if called directly
if (require.main === module) {
  const test = new GameRoomStressTest()
  test.runFullStressTest().catch(console.error)
}

module.exports = GameRoomStressTest
