
class GameRoomClient {
  constructor() {
    this.socket = io()
    this.currentRoom = null
    this.userId = this.generateUserId()
    this.username = null

    this.setupSocketListeners()
    this.setupUI()
  }

  generateUserId() {
    return "user_" + Math.random().toString(36).substr(2, 9)
  }

  setupSocketListeners() {
    this.socket.on("connect", () => {
      console.log("Connected to server")
      this.updateConnectionStatus(true)
    })

    this.socket.on("disconnect", () => {
      console.log("Disconnected from server")
      this.updateConnectionStatus(false)
    })

    this.socket.on("room:created", (room) => {
      this.addRoomToList(room)
    })

    this.socket.on("user:joined", (data) => {
      this.addUserToRoom(data)
    })

    this.socket.on("user:left", (data) => {
      this.removeUserFromRoom(data)
    })

    this.socket.on("chat:message", (data) => {
      this.addChatMessage(data)
    })

    this.socket.on("join:success", (data) => {
      this.currentRoom = data.roomId
      this.showRoomInterface()
    })

    this.socket.on("join:error", (data) => {
      alert("Failed to join room: " + data.error)
    })
  }

  setupUI() {
    // Create main interface
    document.body.innerHTML = `
      <div class="app">
        <header class="header">
          <h1>🎮 Game Room</h1>
          <div class="connection-status" id="connection-status">
            <span class="status-indicator" id="status-indicator"></span>
            <span id="status-text">Connecting...</span>
          </div>
        </header>

        <main class="main">
          <div class="sidebar">
            <div class="user-info">
              <input type="text" id="username-input" placeholder="Enter username" />
              <button onclick="gameClient.setUsername()">Set Username</button>
            </div>

            <div class="room-section">
              <h3>Rooms</h3>
              <button onclick="gameClient.createRoom()">Create Room</button>
              <div class="room-list" id="room-list"></div>
            </div>

            <div class="stats-section">
              <h3>System Stats</h3>
              <div id="system-stats"></div>
              <button onclick="gameClient.refreshStats()">Refresh</button>
            </div>
          </div>

          <div class="content">
            <div class="room-interface" id="room-interface" style="display: none;">
              <div class="room-header">
                <h2 id="room-title">Room</h2>
                <button onclick="gameClient.leaveRoom()">Leave Room</button>
              </div>

              <div class="room-content">
                <div class="chat-section">
                  <div class="chat-messages" id="chat-messages"></div>
                  <div class="chat-input">
                    <input type="text" id="message-input" placeholder="Type a message..." />
                    <button onclick="gameClient.sendMessage()">Send</button>
                  </div>
                </div>

                <div class="players-section">
                  <h3>Players</h3>
                  <div class="players-list" id="players-list"></div>
                </div>
              </div>
            </div>

            <div class="welcome-screen" id="welcome-screen">
              <h2>Welcome to Game Room</h2>
              <p>Set your username and join or create a room to start playing!</p>
              
              <div class="features">
                <h3>Features:</h3>
                <ul>
                  <li>✅ Real-time chat</li>
                  <li>✅ Multiple rooms</li>
                  <li>✅ Fault tolerance</li>
                  <li>✅ Load balancing</li>
                  <li>✅ Database sharding</li>
                  <li>✅ Monitoring</li>
                </ul>
              </div>
            </div>
          </div>
        </main>
      </div>
    `

    // Add CSS
    this.addStyles()

    // Load initial data
    this.loadRooms()
    this.refreshStats()
  }

  addStyles() {
    const style = document.createElement("style")
    style.textContent = `
      * { margin: 0; padding: 0; box-sizing: border-box; }
      
      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        background: #f5f5f5;
      }

      .app {
        height: 100vh;
        display: flex;
        flex-direction: column;
      }

      .header {
        background: #2c3e50;
        color: white;
        padding: 1rem 2rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .connection-status {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .status-indicator {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #e74c3c;
      }

      .status-indicator.connected {
        background: #27ae60;
      }

      .main {
        flex: 1;
        display: flex;
      }

      .sidebar {
        width: 300px;
        background: white;
        padding: 1rem;
        border-right: 1px solid #ddd;
        overflow-y: auto;
      }

      .content {
        flex: 1;
        padding: 1rem;
      }

      .user-info {
        margin-bottom: 1rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid #eee;
      }

      .user-info input {
        width: 100%;
        padding: 0.5rem;
        margin-bottom: 0.5rem;
        border: 1px solid #ddd;
        border-radius: 4px;
      }

      .user-info button {
        width: 100%;
        padding: 0.5rem;
        background: #3498db;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }

      .room-section, .stats-section {
        margin-bottom: 1rem;
      }

      .room-section h3, .stats-section h3 {
        margin-bottom: 0.5rem;
        color: #2c3e50;
      }

      .room-list {
        max-height: 200px;
        overflow-y: auto;
      }

      .room-item {
        padding: 0.5rem;
        margin-bottom: 0.5rem;
        background: #f8f9fa;
        border-radius: 4px;
        cursor: pointer;
        border: 1px solid #e9ecef;
      }

      .room-item:hover {
        background: #e9ecef;
      }

      .room-interface {
        background: white;
        border-radius: 8px;
        padding: 1rem;
        height: 100%;
        display: flex;
        flex-direction: column;
      }

      .room-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid #eee;
      }

      .room-content {
        flex: 1;
        display: flex;
        gap: 1rem;
      }

      .chat-section {
        flex: 2;
        display: flex;
        flex-direction: column;
      }

      .chat-messages {
        flex: 1;
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 1rem;
        overflow-y: auto;
        margin-bottom: 1rem;
        background: #fafafa;
      }

      .chat-input {
        display: flex;
        gap: 0.5rem;
      }

      .chat-input input {
        flex: 1;
        padding: 0.5rem;
        border: 1px solid #ddd;
        border-radius: 4px;
      }

      .players-section {
        flex: 1;
        border-left: 1px solid #eee;
        padding-left: 1rem;
      }

      .welcome-screen {
        background: white;
        border-radius: 8px;
        padding: 2rem;
        text-align: center;
      }

      .features {
        margin-top: 2rem;
        text-align: left;
        max-width: 300px;
        margin-left: auto;
        margin-right: auto;
      }

      button {
        padding: 0.5rem 1rem;
        background: #3498db;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }

      button:hover {
        background: #2980b9;
      }
    `
    document.head.appendChild(style)
  }

  updateConnectionStatus(connected) {
    const indicator = document.getElementById("status-indicator")
    const text = document.getElementById("status-text")

    if (connected) {
      indicator.classList.add("connected")
      text.textContent = "Connected"
    } else {
      indicator.classList.remove("connected")
      text.textContent = "Disconnected"
    }
  }

  setUsername() {
    const input = document.getElementById("username-input")
    this.username = input.value.trim()

    if (this.username) {
      input.disabled = true
      console.log("Username set:", this.username)
    }
  }

  async createRoom() {
    if (!this.username) {
      alert("Please set your username first")
      return
    }

    const roomName = prompt("Enter room name:")
    if (!roomName) return

    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: roomName,
          maxPlayers: 4,
          createdBy: this.userId,
        }),
      })

      const room = await response.json()
      console.log("Room created:", room)
    } catch (error) {
      console.error("Error creating room:", error)
      alert("Failed to create room")
    }
  }

  async loadRooms() {
    try {
      const response = await fetch("/api/rooms")
      const data = await response.json()

      const roomList = document.getElementById("room-list")
      roomList.innerHTML = ""

      if (data.rooms && data.rooms.length > 0) {
        data.rooms.forEach((room) => {
          this.addRoomToList(room)
        })
      } else {
        roomList.innerHTML = '<div class="room-item">No rooms available</div>'
      }
    } catch (error) {
      console.error("Error loading rooms:", error)
    }
  }

  addRoomToList(room) {
    const roomList = document.getElementById("room-list")
    const roomItem = document.createElement("div")
    roomItem.className = "room-item"
    roomItem.innerHTML = `
      <div><strong>${room.name || room.id}</strong></div>
      <div>Players: ${room.players?.length || 0}/${room.maxPlayers || 4}</div>
    `
    roomItem.onclick = () => this.joinRoom(room.id)
    roomList.appendChild(roomItem)
  }

  joinRoom(roomId) {
    if (!this.username) {
      alert("Please set your username first")
      return
    }

    this.socket.emit("join:room", {
      roomId,
      userId: this.userId,
      username: this.username,
    })
  }

  leaveRoom() {
    if (this.currentRoom) {
      this.socket.emit("leave:room", {
        roomId: this.currentRoom,
        userId: this.userId,
      })

      this.currentRoom = null
      this.hideRoomInterface()
    }
  }

  sendMessage() {
    const input = document.getElementById("message-input")
    const message = input.value.trim()

    if (message && this.currentRoom) {
      this.socket.emit("chat:message", {
        roomId: this.currentRoom,
        userId: this.userId,
        username: this.username,
        message,
      })

      input.value = ""
    }
  }

  addChatMessage(data) {
    const chatMessages = document.getElementById("chat-messages")
    const messageElement = document.createElement("div")
    messageElement.innerHTML = `
      <strong>${data.username}:</strong> ${data.message}
      <small style="color: #666; margin-left: 1rem;">
        ${new Date(data.timestamp).toLocaleTimeString()}
      </small>
    `
    chatMessages.appendChild(messageElement)
    chatMessages.scrollTop = chatMessages.scrollHeight
  }

  showRoomInterface() {
    document.getElementById("room-interface").style.display = "flex"
    document.getElementById("welcome-screen").style.display = "none"
    document.getElementById("room-title").textContent = `Room: ${this.currentRoom}`
  }

  hideRoomInterface() {
    document.getElementById("room-interface").style.display = "none"
    document.getElementById("welcome-screen").style.display = "block"
  }

  async refreshStats() {
    try {
      const response = await fetch("/api/monitoring/stats")
      const stats = await response.json()

      const statsContainer = document.getElementById("system-stats")
      statsContainer.innerHTML = `
        <div>Active Users: ${stats.activeUsers || 0}</div>
        <div>Avg Response: ${Math.round(stats.averageResponseTime || 0)}ms</div>
        <div>Uptime: ${Math.round(((stats.systemMetrics?.uptime || 0) / 3600) * 100) / 100}h</div>
        <div>Memory: ${Math.round((stats.systemMetrics?.memory?.heapUsed || 0) / 1024 / 1024)}MB</div>
      `
    } catch (error) {
      console.error("Error fetching stats:", error)
    }
  }

  addUserToRoom(data) {
    // Implementation for adding user to room UI
    console.log("User joined:", data)
  }

  removeUserFromRoom(data) {
    // Implementation for removing user from room UI
    console.log("User left:", data)
  }
}

// Initialize client when page loads
let gameClient
document.addEventListener("DOMContentLoaded", () => {
  gameClient = new GameRoomClient()
})
