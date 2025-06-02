class GameRoomClient {
  constructor() {
    this.socket = null
    this.currentRoom = null
    this.userId = this.generateUserId()
    this.userPing = 0
    this.chatHistory = []

    this.init()
  }

  generateUserId() {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  init() {
    this.connectSocket()
    this.setupEventListeners()
    this.startPingMonitoring()
    this.loadRooms()
  }

  connectSocket() {
    this.socket = io()

    this.socket.on("connect", () => {
      this.updateConnectionStatus(true)
      console.log("Connected to server")
    })

    this.socket.on("disconnect", () => {
      this.updateConnectionStatus(false)
      console.log("Disconnected from server")
    })

    this.socket.on("chat-message", (data) => {
      this.displayMessage(data)
    })

    this.socket.on("user-joined", (data) => {
      this.displaySystemMessage(data.message)
      this.updateMemberCount()
    })

    this.socket.on("user-left", (data) => {
      this.displaySystemMessage(data.message)
      this.updateMemberCount()
    })
  }

  updateConnectionStatus(connected) {
    const statusElement = document.getElementById("connection-status")
    if (connected) {
      statusElement.textContent = "Đã kết nối"
      statusElement.className = "connected"
    } else {
      statusElement.textContent = "Mất kết nối"
      statusElement.className = "disconnected"
    }
  }

  setupEventListeners() {
    // Create room
    document.getElementById("create-room-btn").addEventListener("click", () => {
      this.createRoom()
    })

    document.getElementById("room-name").addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.createRoom()
      }
    })

    // Chat
    document.getElementById("send-message-btn").addEventListener("click", () => {
      this.sendMessage()
    })

    document.getElementById("chat-input").addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.sendMessage()
      }
    })

    // Leave room
    document.getElementById("leave-room-btn").addEventListener("click", () => {
      this.leaveRoom()
    })

    // Chat features
    document.getElementById("emoji-btn").addEventListener("click", () => {
      this.showEmojiPicker()
    })

    document.getElementById("clear-chat-btn").addEventListener("click", () => {
      this.clearChat()
    })

    document.getElementById("export-chat-btn").addEventListener("click", () => {
      this.exportChat()
    })

    // Emoji picker
    document.querySelector(".close").addEventListener("click", () => {
      this.hideEmojiPicker()
    })

    document.querySelectorAll(".emoji").forEach((emoji) => {
      emoji.addEventListener("click", (e) => {
        this.insertEmoji(e.target.textContent)
      })
    })

    // Modal close on outside click
    window.addEventListener("click", (e) => {
      const modal = document.getElementById("emoji-modal")
      if (e.target === modal) {
        this.hideEmojiPicker()
      }
    })
  }

  async createRoom() {
    const roomNameInput = document.getElementById("room-name")
    const roomName = roomNameInput.value.trim()

    if (!roomName) {
      alert("Vui lòng nhập tên phòng!")
      return
    }

    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-ID": this.userId,
        },
        body: JSON.stringify({ roomName }),
      })

      if (response.ok) {
        const room = await response.json()
        roomNameInput.value = ""
        this.joinRoom(room.id, room.name)
        this.loadRooms() // Refresh room list
      } else {
        const error = await response.json()
        alert(`Lỗi tạo phòng: ${error.error}`)
      }
    } catch (error) {
      console.error("Error creating room:", error)
      alert("Không thể tạo phòng. Vui lòng thử lại!")
    }
  }

  async loadRooms() {
    try {
      const response = await fetch("/api/rooms")
      const rooms = await response.json()
      this.displayRooms(rooms)
    } catch (error) {
      console.error("Error loading rooms:", error)
      document.getElementById("rooms-container").innerHTML = '<div class="loading">Không thể tải danh sách phòng</div>'
    }
  }

  displayRooms(rooms) {
    const container = document.getElementById("rooms-container")

    if (rooms.length === 0) {
      container.innerHTML = '<div class="loading">Chưa có phòng nào. Hãy tạo phòng đầu tiên!</div>'
      return
    }

    container.innerHTML = rooms
      .map(
        (room) => `
            <div class="room-card" onclick="gameRoomClient.joinRoom('${room.id}', '${room.name}')">
                <h3>${room.name}</h3>
                <div class="room-info">
                    <span>ID: ${room.id}</span>
                    <span>Thành viên: ${room.members ? room.members.length : 0}</span>
                    <span class="ping-indicator ${this.getPingClass(room.avgPing)}">
                        Ping: ${room.avgPing || 0}ms
                    </span>
                    <span>Tạo: ${new Date(room.createdAt).toLocaleString("vi-VN")}</span>
                </div>
            </div>
        `,
      )
      .join("")
  }

  getPingClass(ping) {
    if (ping < 50) return "ping-excellent"
    if (ping < 100) return "ping-good"
    if (ping < 150) return "ping-fair"
    return "ping-poor"
  }

  joinRoom(roomId, roomName) {
    this.currentRoom = { id: roomId, name: roomName }

    // Join socket room
    this.socket.emit("join-room", {
      roomId: roomId,
      userId: this.userId,
      userPing: this.userPing,
    })

    // Show chat section
    document.getElementById("chat-section").style.display = "block"
    document.getElementById("current-room-name").textContent = roomName

    // Clear previous messages
    document.getElementById("chat-messages").innerHTML = ""

    // Load game suggestion
    this.loadGameSuggestion(roomId)

    // Scroll to chat section
    document.getElementById("chat-section").scrollIntoView({ behavior: "smooth" })
  }

  async loadGameSuggestion(roomId) {
    try {
      const response = await fetch(`/api/rooms/${roomId}/suggestion`)
      const suggestion = await response.json()

      const suggestionContent = document.getElementById("suggestion-content")
      suggestionContent.innerHTML = `
                <p><strong>${suggestion.category}</strong> - ${suggestion.reason}</p>
                <div class="suggestion-games">
                    ${suggestion.games.map((game) => `<span class="game-tag">${game}</span>`).join("")}
                </div>
            `
    } catch (error) {
      console.error("Error loading game suggestion:", error)
    }
  }

  leaveRoom() {
    if (this.currentRoom) {
      this.socket.emit("leave-room", {
        roomId: this.currentRoom.id,
        userId: this.userId,
      })

      this.currentRoom = null
      document.getElementById("chat-section").style.display = "none"
      this.loadRooms() // Refresh room list
    }
  }

  sendMessage() {
    const input = document.getElementById("chat-input")
    const message = input.value.trim()

    if (!message || !this.currentRoom) return

    this.socket.emit("chat-message", {
      roomId: this.currentRoom.id,
      message: message,
      userId: this.userId,
    })

    input.value = ""
  }

  displayMessage(data) {
    const messagesContainer = document.getElementById("chat-messages")
    const isOwnMessage = data.userId === this.userId

    const messageElement = document.createElement("div")
    messageElement.className = `message ${isOwnMessage ? "own" : ""}`

    messageElement.innerHTML = `
            <div class="message-header">
                <span>${data.userId}</span>
                <span>${new Date(data.timestamp).toLocaleTimeString("vi-VN")}</span>
            </div>
            <div class="message-content">${this.escapeHtml(data.message)}</div>
        `

    messagesContainer.appendChild(messageElement)
    messagesContainer.scrollTop = messagesContainer.scrollHeight

    // Store in chat history
    this.chatHistory.push(data)
  }

  displaySystemMessage(message) {
    const messagesContainer = document.getElementById("chat-messages")

    const messageElement = document.createElement("div")
    messageElement.className = "message system"
    messageElement.innerHTML = `
            <div class="message-content">${message}</div>
        `

    messagesContainer.appendChild(messageElement)
    messagesContainer.scrollTop = messagesContainer.scrollHeight
  }

  startPingMonitoring() {
    // Measure ping every 5 seconds
    setInterval(() => {
      this.measurePing()
    }, 5000)
  }

  measurePing() {
    const start = Date.now()

    fetch("/api/health")
      .then(() => {
        this.userPing = Date.now() - start
        document.getElementById("ping-display").textContent = `Ping: ${this.userPing}ms`

        // Update room ping if in a room
        if (this.currentRoom) {
          this.socket.emit("ping-update", { ping: this.userPing })
          document.getElementById("room-ping").textContent = `Ping: ${this.userPing}ms`
        }
      })
      .catch(() => {
        this.userPing = 999
        document.getElementById("ping-display").textContent = "Ping: --ms"
      })
  }

  updateMemberCount() {
    // This would need to be implemented with proper member tracking
    // For now, just a placeholder
  }

  showEmojiPicker() {
    document.getElementById("emoji-modal").style.display = "block"
  }

  hideEmojiPicker() {
    document.getElementById("emoji-modal").style.display = "none"
  }

  insertEmoji(emoji) {
    const input = document.getElementById("chat-input")
    input.value += emoji
    input.focus()
    this.hideEmojiPicker()
  }

  clearChat() {
    if (confirm("Bạn có chắc muốn xóa toàn bộ chat?")) {
      document.getElementById("chat-messages").innerHTML = ""
      this.chatHistory = []
    }
  }

  exportChat() {
    if (this.chatHistory.length === 0) {
      alert("Không có tin nhắn để xuất!")
      return
    }

    const chatText = this.chatHistory
      .map((msg) => `[${new Date(msg.timestamp).toLocaleString("vi-VN")}] ${msg.userId}: ${msg.message}`)
      .join("\n")

    const blob = new Blob([chatText], { type: "text/plain" })
    const url = URL.createObjectURL(blob)

    const a = document.createElement("a")
    a.href = url
    a.download = `chat_${this.currentRoom?.name || "room"}_${new Date().toISOString().split("T")[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  escapeHtml(text) {
    const div = document.createElement("div")
    div.textContent = text
    return div.innerHTML
  }
}

// Initialize the client
const gameRoomClient = new GameRoomClient()

// Auto-refresh room list every 30 seconds
setInterval(() => {
  if (!gameRoomClient.currentRoom) {
    gameRoomClient.loadRooms()
  }
}, 30000)
