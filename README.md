# Game Room Distributed System với InfluxDB

Hệ thống phòng chơi game phân tán với khả năng fault tolerance, monitoring và load balancing.

## 🏗️ Kiến trúc hệ thống

### Thành phần chính:
- **3 App Instances** (app1, app2, app3) - Load balanced
- **3 InfluxDB Instances** - Data sharding
- **Nginx** - Load balancer & reverse proxy
- **Redis** - Session management & caching
- **Grafana** - Monitoring dashboard

### Tính năng:
- ✅ **Fault Tolerance**: Hệ thống tiếp tục hoạt động khi một nút bị lỗi
- ✅ **Distributed Communication**: Giao tiếp qua HTTP, WebSocket
- ✅ **Data Sharding**: Phân mảnh dữ liệu giữa 3 InfluxDB instances
- ✅ **Monitoring**: Grafana dashboard với real-time metrics
- ✅ **Stress Testing**: Kiểm tra tải với 1000+ concurrent requests

## 🚀 Cài đặt và chạy

### Yêu cầu:
- Docker & Docker Compose
- Node.js 18+
- 8GB RAM khuyến nghị

### Khởi chạy:
\`\`\`bash
# Clone repository
git clone <repository-url>
cd game-room-distributed-system

# Khởi chạy toàn bộ hệ thống
chmod +x scripts/deploy.sh
./scripts/deploy.sh

# Hoặc chạy thủ công
docker-compose up -d
\`\`\`

### Truy cập:
- **Ứng dụng chính**: http://localhost
- **Grafana Dashboard**: http://localhost:3000 (admin/admin123)
- **InfluxDB 1**: http://localhost:8086
- **InfluxDB 2**: http://localhost:8087  
- **InfluxDB 3**: http://localhost:8088

## 🧪 Kiểm tra hệ thống

### Stress Test:
\`\`\`bash
npm run stress-test
\`\`\`

### Monitoring:
\`\`\`bash
chmod +x scripts/monitor.sh
./scripts/monitor.sh
\`\`\`

### Health Check:
\`\`\`bash
curl http://localhost/api/health
\`\`\`

## 📊 Tính năng chính

### 1. Tạo phòng tự động
- Chỉ cần nhập tên phòng
- Tự động tạo mã phòng unique
- Ghi log vào InfluxDB

### 2. Ping Monitoring
- Đo ping mỗi 10 giây
- Tính ping trung bình của phòng
- Gợi ý game dựa trên ping

### 3. Chat System
- Real-time messaging
- Emoji support
- Export chat history
- System notifications

### 4. Game Suggestions
- **< 50ms**: Competitive games (CS2, Valorant)
- **50-100ms**: Action games (Fortnite, Apex)
- **100-150ms**: Strategy games (Civilization)
- **> 150ms**: Turn-based games (Hearthstone)

## 🔧 Cấu hình

### Environment Variables:
\`\`\`bash
cp .env.example .env
# Chỉnh sửa các giá trị cần thiết
\`\`\`

### Scaling:
\`\`\`bash
# Scale app instances
docker-compose up -d --scale app1=2 --scale app2=2

# Add more InfluxDB instances
# Chỉnh sửa docker-compose.yml
\`\`\`

## 📈 Monitoring & Logging

### Grafana Dashboards:
- Room creation rate
- Average ping by room  
- Active rooms by instance
- System health metrics

### InfluxDB Metrics:
- `room_created`: Room creation events
- `ping_update`: Ping measurements
- `user_activity`: User interactions

## 🛡️ Fault Tolerance

### Load Balancing:
- Nginx với least_conn algorithm
- Health checks mỗi 30s
- Automatic failover

### Data Replication:
- Redis cho session persistence
- InfluxDB sharding theo app instance
- Cross-instance room synchronization

## 🧪 Testing

### Unit Tests:
\`\`\`bash
npm test
\`\`\`

### Integration Tests:
\`\`\`bash
npm run test:integration
\`\`\`

### Performance Tests:
\`\`\`bash
npm run stress-test
\`\`\`

## 📝 API Documentation

### Endpoints:
- `GET /api/health` - Health check
- `POST /api/rooms` - Tạo phòng mới
- `GET /api/rooms` - Danh sách phòng
- `GET /api/rooms/:id/suggestion` - Gợi ý game

### WebSocket Events:
- `join-room` - Tham gia phòng
- `chat-message` - Gửi tin nhắn
- `ping-update` - Cập nhật ping
- `leave-room` - Rời phòng

## 🔍 Troubleshooting

### Kiểm tra logs:
\`\`\`bash
docker-compose logs -f app1
docker-compose logs -f nginx
docker-compose logs -f influxdb1
\`\`\`

### Restart services:
\`\`\`bash
docker-compose restart
\`\`\`

### Clean rebuild:
\`\`\`bash
docker-compose down -v
docker-compose up -d --build
\`\`\`

## 📄 License

MIT License - xem file LICENSE để biết thêm chi tiết.
