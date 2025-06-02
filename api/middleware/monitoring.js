const monitoringService = require("../services/monitoringService")

// Middleware to track API requests
const apiMonitoring = (req, res, next) => {
  const startTime = Date.now()

  // Override res.end to capture response time
  const originalEnd = res.end
  res.end = function (...args) {
    const responseTime = Date.now() - startTime
    const userId = req.headers["x-user-id"] || req.user?.id || null

    // Log API request metrics
    monitoringService
      .logApiRequest(req.route?.path || req.path, req.method, responseTime, res.statusCode, userId)
      .catch(console.error)

    originalEnd.apply(this, args)
  }

  next()
}

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  console.error("❌ API Error:", err)

  // Log error to InfluxDB
  monitoringService
    .logApiRequest(req.route?.path || req.path, req.method, 0, 500, req.headers["x-user-id"] || null)
    .catch(console.error)

  res.status(500).json({
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "development" ? err.message : "Something went wrong",
    timestamp: new Date().toISOString(),
    appInstance: process.env.APP_ID || "unknown",
  })
}

// Rate limiting middleware
const rateLimit = (maxRequests = 100, windowMs = 60000) => {
  const requests = new Map()

  return (req, res, next) => {
    const clientId = req.ip || req.connection.remoteAddress
    const now = Date.now()

    if (!requests.has(clientId)) {
      requests.set(clientId, { count: 1, resetTime: now + windowMs })
      return next()
    }

    const clientData = requests.get(clientId)

    if (now > clientData.resetTime) {
      clientData.count = 1
      clientData.resetTime = now + windowMs
      return next()
    }

    if (clientData.count >= maxRequests) {
      return res.status(429).json({
        error: "Too Many Requests",
        message: "Rate limit exceeded",
        retryAfter: Math.ceil((clientData.resetTime - now) / 1000),
      })
    }

    clientData.count++
    next()
  }
}

module.exports = {
  apiMonitoring,
  errorHandler,
  rateLimit,
}
