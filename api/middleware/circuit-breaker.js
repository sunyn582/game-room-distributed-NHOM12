
class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name
    this.state = "CLOSED" // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0
    this.failureThreshold = options.failureThreshold || 5
    this.timeout = options.timeout || 60000 // 1 minute
    this.resetTimeout = options.resetTimeout || 30000 // 30 seconds
    this.nextAttempt = Date.now()
    this.successCount = 0
    this.monitor = options.monitor || console.log
  }

  async execute(operation) {
    if (this.state === "OPEN") {
      if (this.nextAttempt <= Date.now()) {
        this.state = "HALF_OPEN"
        this.monitor(`Circuit breaker ${this.name} is now HALF_OPEN`)
      } else {
        throw new Error(`Circuit breaker ${this.name} is OPEN`)
      }
    }

    try {
      const result = await operation()
      return this.onSuccess(result)
    } catch (error) {
      return this.onFailure(error)
    }
  }

  onSuccess(result) {
    this.failureCount = 0

    if (this.state === "HALF_OPEN") {
      this.successCount++
      if (this.successCount >= 3) {
        // Require 3 successes to close
        this.state = "CLOSED"
        this.successCount = 0
        this.monitor(`Circuit breaker ${this.name} is now CLOSED`)
      }
    }

    return result
  }

  onFailure(error) {
    this.failureCount++

    if (this.failureCount >= this.failureThreshold) {
      this.state = "OPEN"
      this.nextAttempt = Date.now() + this.timeout
      this.monitor(`Circuit breaker ${this.name} is now OPEN due to ${this.failureCount} failures`)
    }

    throw error
  }

  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      nextAttempt: this.nextAttempt,
      successCount: this.successCount,
    }
  }
}

module.exports = CircuitBreaker
