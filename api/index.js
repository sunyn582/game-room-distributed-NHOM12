const express = require("express")
const cors = require("cors")
const helmet = require("helmet")
const compression = require("compression")

// Import routes
const roomsRouter = require("./routes/rooms")
const healthRouter = require("./routes/health")
const monitoringRouter = require("./routes/monitoring")

// Import middleware
const { errorHandler } = require("./middleware/monitoring")

// Initialize Express app
const app = express()

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable for development
    crossOriginEmbedderPolicy: false,
  }),
)

// CORS configuration
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-User-ID"],
    credentials: true,
  }),
)

// Compression middleware
app.use(compression())

// Body parsing middleware
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

// Request logging middleware
app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.path} - ${req.ip} - ${new Date().toISOString()}`)
  next()
})

// API Routes
app.use("/api/health", healthRouter)
app.use("/api/rooms", roomsRouter)
app.use("/api/monitoring", monitoringRouter)

// Root endpoint
app.get("/api", (req, res) => {
  res.json({
    message: "Game Room Distributed System API",
    version: "2.0.0",
    appInstance: process.env.APP_ID || "unknown",
    timestamp: new Date().toISOString(),
    endpoints: {
      health: "/api/health",
      rooms: "/api/rooms",
      monitoring: "/api/monitoring",
    },
  })
})

// 404 handler
app.use("/api/*", (req, res) => {
  res.status(404).json({
    success: false,
    error: "API endpoint not found",
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  })
})

// Error handling middleware
app.use(errorHandler)

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM received, shutting down gracefully")
  process.exit(0)
})

process.on("SIGINT", () => {
  console.log("🛑 SIGINT received, shutting down gracefully")
  process.exit(0)
})

module.exports = app

// Start server if this file is run directly
if (require.main === module) {
  const PORT = process.env.PORT || 3000
  app.listen(PORT, () => {
    console.log(`🚀 Game Room API Server running on port ${PORT}`)
    console.log(`📊 App Instance: ${process.env.APP_ID || "unknown"}`)
    console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`)
  })
}
