# Nhóm 12 - Game Room Distributed System với InfluxDB

Dự án phòng chơi game phân tán sử dụng InfluxDB để theo dõi và phân tích hiệu suất.

## Tính năng

### Frontend
- ✅ Giao diện tạo phòng và vào phòng
- ✅ Chat realtime trong phòng
- ✅ Đo ping realtime và hiển thị ping trung bình của phòng
- ✅ Gợi ý dựa trên ping (Tuyệt vời/Tốt/Trung bình/Kém)
- ✅ Responsive design

### Backend
- ✅ Server Node.js với Socket.IO
- ✅ Đo ping realtime cho từng user
- ✅ Tính ping trung bình của phòng
- ✅ API RESTful cho quản lý phòng

### InfluxDB Integration
- ✅ Ghi dữ liệu tạo phòng với thời gian response
- ✅ Ghi dữ liệu vào phòng với thời gian response  
- ✅ Ghi ping phòng mỗi 10 giây
- ✅ API thống kê từ InfluxDB
- ✅ Theo dõi hiệu suất hệ thống

### Hệ thống phân tán
- ✅ Load balancer với Nginx
- ✅ 3 instance ứng dụng
- ✅ Docker containerization
- ✅ Fault tolerance

## Cài đặt và chạy

### 1. Clone repository
\`\`\`bash
git clone <repository-url>
cd game-room-distributed
\`\`\`

### 2. Chạy với Docker Compose
\`\`\`bash
docker-compose up --build
\`\`\`

### 3. Truy cập ứng dụng
- **Ứng dụng chính**: http://localhost
- **InfluxDB UI**: http://localhost:8086
- **Instance 1**: http://localhost:3001  
- **Instance 2**: http://localhost:3002
- **Instance 3**: http://localhost:3003

## Cấu trúc dự án
![Cấu trúc dự án](image.png)
## API Endpoints

### REST API
- `POST /api/create-room` - Tạo phòng mới
- `GET /api/room/:roomId` - Lấy thông tin phòng
- `GET /api/stats` - Thống kê hệ thống

### Socket.IO Events
- `join-room` - Vào phòng
- `chat-message` - Gửi tin nhắn
- `ping-test` / `pong-test` - Đo ping
- `update-ping` - Cập nhật ping

### API Endpoints Nhóm 12
- `GET /api/nhom12/stats` - Thống kê tổng quan nhóm 12
- `GET /api/nhom12/top-rooms` - Top phòng có ping tốt nhất
- `GET /api/nhom12/instances` - Thống kê theo instance

## InfluxDB Schema

### Measurements
1. **room_creation**
   - Tags: room_id, instance_id
   - Fields: response_time_ms

2. **room_join**  
   - Tags: room_id, user_id, instance_id
   - Fields: response_time_ms

3. **room_ping**
   - Tags: room_id, instance_id  
   - Fields: average_ping_ms, user_count

### InfluxDB Schema (Bucket: wed-game)

## Monitoring và Analytics

### Thống kê realtime
- Số phòng đang hoạt động
- Tổng số phòng đã tạo
- Tổng lượt vào phòng
- Ping trung bình theo thời gian

### Gợi ý ping
- **< 50ms**: Tuyệt vời - Phù hợp mọi game
- **50-100ms**: Tốt - Phù hợp hầu hết game  
- **100-200ms**: Trung bình - Game ít yêu cầu phản xạ
- **> 200ms**: Kém - Cần kiểm tra mạng

## Troubleshooting

### Lỗi kết nối InfluxDB
\`\`\`bash
# Kiểm tra container
docker-compose ps

# Xem logs
docker-compose logs influxdb
\`\`\`

### Lỗi load balancer
\`\`\`bash
# Restart nginx
docker-compose restart nginx
\`\`\`

## Phát triển

### Chạy development mode
\`\`\`bash
npm install
npm run dev
\`\`\`

### Thêm tính năng mới
1. Cập nhật API trong `app/server.js`
2. Thêm InfluxDB queries trong `api/influxdb.js`  
3. Cập nhật frontend trong `view/`
4. Test với Docker Compose

## License

MIT License
\`\`\`

Dự án này tạo ra một hệ thống phòng chơi game phân tán hoàn chỉnh với:

1. **Frontend**: Giao diện đẹp với HTML/CSS/JS thuần
2. **Backend**: Node.js + Socket.IO + Express
3. **Database**: InfluxDB để lưu trữ time-series data
4. **Phân tán**: 3 instance + Nginx load balancer
5. **Monitoring**: Theo dõi ping, response time, thống kê realtime
6. **Docker**: Containerization hoàn chỉnh

Bạn có thể chạy `docker-compose up --build` để khởi động toàn bộ hệ thống!
