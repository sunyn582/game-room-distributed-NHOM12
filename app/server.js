const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");

// Import các modules mới
const { InfluxDB, Point } = require('@influxdata/influxdb-client');
const HealthChecker = require("../api/health/health-check");
const CircuitBreaker = require("../api/middleware/circuit-breaker");
const DatabaseSharding = require("../api/services/database-sharding");
const MonitoringService = require("../api/services/monitoring-service");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// QUAN TRỌNG: Giữ nguyên static path cho view cũ
app.use(express.static(path.join(__dirname, "../view")));

// Initialize services mới
const healthChecker = new HealthChecker();
const dbSharding = new DatabaseSharding();
const monitoring = new MonitoringService();

// Circuit breakers cho services mới
const dbCircuitBreaker = new CircuitBreaker("database", {
    failureThreshold: 5,
    recoveryTimeout: 30000
});

// Health check endpoint (tính năng mới)
app.get('/health', async (req, res) => {
    const healthStatus = await healthChecker.checkHealth();
    res.status(200).json(healthStatus);
});

// Metrics endpoint (tính năng mới)
app.get('/metrics', (req, res) => {
    const metrics = monitoring.getMetrics();
    res.json(metrics);
});

// GIỮ NGUYÊN: Routes cho view cũ
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../view/index.html'));
});

app.get('/game', (req, res) => {
    res.sendFile(path.join(__dirname, '../view/game.html'));
});

app.get('/lobby', (req, res) => {
    res.sendFile(path.join(__dirname, '../view/lobby.html'));
});

// Game state management
let gameRooms = new Map();
let players = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // Monitoring connection (tính năng mới)
    monitoring.recordConnection();
    
    // GIỮ NGUYÊN: Join room logic cũ
    socket.on('join-room', async (data) => {
        const { roomId, playerName } = data;
        
        // Thêm circuit breaker cho database operations (tính năng mới)
        try {
            await dbCircuitBreaker.execute(async () => {
                await dbSharding.savePlayerData(socket.id, { roomId, playerName });
            });
        } catch (error) {
            console.error('Database error:', error);
            // Tiếp tục xử lý ngay cả khi database lỗi
        }
        
        socket.join(roomId);
        
        if (!gameRooms.has(roomId)) {
            gameRooms.set(roomId, {
                players: [],
                gameState: 'waiting',
                createdAt: new Date()
            });
        }
        
        const room = gameRooms.get(roomId);
        room.players.push({
            id: socket.id,
            name: playerName,
            ready: false
        });
        
        players.set(socket.id, { roomId, playerName });
        
        // GIỮ NGUYÊN: Emit to room (logic cũ)
        io.to(roomId).emit('player-joined', {
            players: room.players,
            gameState: room.gameState
        });
        
        // Monitoring (tính năng mới)
        monitoring.recordEvent('player_joined', { roomId });
    });
    
    // GIỮ NGUYÊN: Player ready logic cũ
    socket.on('player-ready', (data) => {
        const player = players.get(socket.id);
        if (!player) return;
        
        const room = gameRooms.get(player.roomId);
        if (!room) return;
        
        const playerInRoom = room.players.find(p => p.id === socket.id);
        if (playerInRoom) {
            playerInRoom.ready = data.ready;
            
            io.to(player.roomId).emit('player-status-changed', {
                players: room.players
            });
            
            // Check if all players ready
            const allReady = room.players.every(p => p.ready);
            if (allReady && room.players.length >= 2) {
                room.gameState = 'playing';
                io.to(player.roomId).emit('game-start', {
                    gameState: room.gameState
                });
                
                // Monitoring (tính năng mới)
                monitoring.recordEvent('game_started', { roomId: player.roomId });
            }
        }
    });
    
    // GIỮ NGUYÊN: Game move logic cũ với monitoring mới
    socket.on('game-move', (data) => {
        const player = players.get(socket.id);
        if (!player) return;
        
        const room = gameRooms.get(player.roomId);
        if (!room || room.gameState !== 'playing') return;
        
        // Broadcast move to room
        socket.to(player.roomId).emit('opponent-move', data);
        
        // Monitoring (tính năng mới)
        monitoring.recordEvent('game_move', { roomId: player.roomId });
        
        // Lưu game state vào database (không chặn luồng chính)
        dbCircuitBreaker.execute(() => {
            dbSharding.saveGameMove(player.roomId, socket.id, data)
                .catch(err => console.error('Error saving game move:', err));
        }).catch(err => console.error('Circuit breaker error:', err));
    });
    
    // GIỮ NGUYÊN: Chat message logic cũ
    socket.on('chat-message', (data) => {
        const player = players.get(socket.id);
        if (!player) return;
        
        io.to(player.roomId).emit('chat-message', {
            playerName: player.playerName,
            message: data.message
        });
        
        // Monitoring (tính năng mới)
        monitoring.recordEvent('chat_message', { roomId: player.roomId });
    });
    
    // GIỮ NGUYÊN: Disconnect handling logic cũ với cleanup mới
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        const player = players.get(socket.id);
        if (player) {
            const room = gameRooms.get(player.roomId);
            if (room) {
                // Remove player from room
                room.players = room.players.filter(p => p.id !== socket.id);
                
                if (room.players.length === 0) {
                    gameRooms.delete(player.roomId);
                } else {
                    io.to(player.roomId).emit('player-left', {
                        players: room.players,
                        gameState: room.players.length < 2 ? 'waiting' : room.gameState
                    });
                }
            }
            
            // Cleanup database (không chặn luồng chính)
            dbCircuitBreaker.execute(() => {
                dbSharding.removePlayerData(socket.id)
                    .catch(err => console.error('Error removing player data:', err));
            }).catch(err => console.error('Circuit breaker error:', err));
            
            players.delete(socket.id);
        }
        
        // Monitoring (tính năng mới)
        monitoring.recordDisconnection();
    });
});

// Periodic cleanup (tính năng mới, chạy ngầm)
setInterval(() => {
    const now = new Date();
    for (const [roomId, room] of gameRooms.entries()) {
        // Remove empty rooms older than 1 hour
        if (room.players.length === 0 && (now - room.createdAt) > 3600000) {
            gameRooms.delete(roomId);
        }
    }
}, 300000); // Run every 5 minutes
// Ping monitoring cho từng room
setInterval(async () => {
    for (const [roomId, room] of gameRooms.entries()) {
        if (room.players.length > 0) {
            // Đo ping của room
            const pingData = await measureRoomPing(roomId, room.players);
            
            // Lưu vào InfluxDB bucket
            await saveToInfluxDB(roomId, pingData);
        }
    }
}, 10000); // Mỗi 10 giây

// Error handling middleware (tính năng mới)
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    monitoring.recordError(error);
    res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Game available at http://localhost:${PORT}`);
    
    // Initialize monitoring (tính năng mới)
    monitoring.start();
});

module.exports = { app, server, io };