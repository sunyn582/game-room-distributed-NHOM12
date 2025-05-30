#  Nhóm 12 - Game Room Distributed System with InfluxDB

Hệ thống **Phòng chơi game phân tán** được xây dựng bằng Node.js, Socket.IO, Docker và InfluxDB để theo dõi hiệu suất kết nối thời gian thực. Đây là bài tập ứng dụng kiến thức hệ thống phân tán với khả năng mở rộng, giám sát và cân bằng tải.

---

##  Mục tiêu dự án

- Triển khai hệ thống phòng chơi game đa người dùng
- Theo dõi hiệu suất mạng theo thời gian thực
- Áp dụng kiến trúc **distributed system**
- Thực hành **containerization** và giám sát bằng **InfluxDB**
- Sử dụng **load balancer (Nginx)** để phân phối tải

---

##  Yêu cầu hệ thống

- Docker & Docker Compose
- Node.js >= 16.x
- Trình duyệt hỗ trợ WebSocket
- InfluxDB 2.x

---

##  Các thành phần chính

### Frontend
- Tạo và vào phòng
- Chat realtime trong phòng
- Đo và hiển thị ping người dùng
- Gợi ý chất lượng ping
- Responsive (tương thích di động)

### Backend
- Node.js + Express + Socket.IO
- Xử lý ping và thống kê
- API RESTful quản lý phòng

### InfluxDB
- Ghi lại thông tin phòng, lượt vào, ping
- Truy vấn dữ liệu thống kê
- Cung cấp dữ liệu giám sát hiệu suất

### Distributed Architecture
- 3 instance backend
- Load balancer (Nginx)
- Docker container cho từng service
- Fault-tolerance cơ bản

---

##  Cấu trúc dự án

```
game-room-distributed/
├── api/
│   └── influxdb.js          # InfluxDB service
├── app/
│   └── server.js            # Main server
├── view/
│   ├── index.html           # Trang chủ
│   └── room.html            # Trang phòng
├── docker-compose.yml       # Docker services
├── Dockerfile              # App container
├── nginx.conf              # Load balancer config
├── package.json            # Dependencies
└── README.md
```

![Sơ đồ kiến trúc](image/cautruc.png)
---

##  Cài đặt và chạy hệ thống

### 1. Clone repository
```bash
git clone <repository-url>
cd game-room-distributed
```

### 2. Khởi động hệ thống
```bash
docker-compose up --build
```

### 3. Truy cập giao diện
- Ứng dụng chính: http://localhost
- InfluxDB UI: http://localhost:8086  
- Backend instances:
  - http://localhost:3001
  - http://localhost:3002
  - http://localhost:3003

---

##  API và Socket.IO

### REST API
| Endpoint                  | Mô tả                    |
|---------------------------|--------------------------|
| `POST /api/create-room`   | Tạo phòng mới            |
| `GET /api/room/:roomId`   | Lấy thông tin phòng      |
| `GET /api/stats`          | Thống kê hệ thống        |

### Nhóm 12 APIs
| Endpoint                            | Mô tả                            |
|-------------------------------------|----------------------------------|
| `GET /api/nhom12/stats`             | Thống kê tổng quan hệ thống      |
| `GET /api/nhom12/top-rooms`         | Top phòng có ping tốt nhất       |
| `GET /api/nhom12/instances`         | Thống kê theo từng instance      |

### Socket.IO Events
- `join-room`: Tham gia phòng
- `chat-message`: Gửi tin nhắn
- `ping-test`, `pong-test`: Đo ping
- `update-ping`: Cập nhật ping người dùng

---

##  InfluxDB Schema

### Bucket: `wed-game`

#### 1. `room_creation`
- Tags: `room_id`, `instance_id`
- Fields: `response_time_ms`

#### 2. `room_join`
- Tags: `room_id`, `user_id`, `instance_id`
- Fields: `response_time_ms`

#### 3. `room_ping`
- Tags: `room_id`, `instance_id`
- Fields: `average_ping_ms`, `user_count`

---

##  Giám sát & Thống kê

### Realtime Metrics
- Số phòng đang hoạt động
- Tổng số phòng đã tạo
- Tổng lượt vào phòng
- Ping trung bình

### Gợi ý ping theo chất lượng
| Ping (ms)    | Đánh giá      | Gợi ý                    |
|--------------|---------------|---------------------------|
| < 50         | Tuyệt vời     | Phù hợp mọi game          |
| 50 – 100     | Tốt           | Chơi ổn định              |
| 100 – 200    | Trung bình    | Game ít yêu cầu phản xạ   |
| > 200        | Kém           | Nên kiểm tra lại mạng     |

---

##  Phát triển & mở rộng

### Chạy development mode
```bash
npm install
npm run dev
```

### Các bước thêm tính năng mới
1. Cập nhật API trong `app/server.js`
2. Thêm truy vấn InfluxDB tại `api/influxdb.js`
3. Cập nhật giao diện tại `view/`
4. Kiểm thử hệ thống qua `docker-compose`

---

##  Troubleshooting

### InfluxDB không hoạt động?
```bash
docker-compose ps
docker-compose logs influxdb
```

### Nginx không cân bằng tải?
```bash
docker-compose restart nginx
```

---

##  License

Dự án được phát hành theo giấy phép mã nguồn mở MIT.  
© Nhóm 12 – Phenikaa University

---

##  Thành viên nhóm và cách liên lạc

| Họ và Tên         | Email                             | Chức vụ           |
|-------------------|-----------------------------------|-------------------|
| Vũ Văn Sơn        | 23010060@st.phenikaa-uni.edu.vn   | Trưởng nhóm       |
| Đặng Thanh Huyền  | 22010033@st.phenikaa-uni.edu.vn   | Thành viên        |

---

##  Bắt đầu chạy nhanh

```bash
docker-compose up --build
```

---

##  Tổng kết

Dự án cung cấp:
- Hệ thống chat đa người dùng phân tán
- Đo đạc và thống kê ping thời gian thực
- Áp dụng kiến trúc microservices và load balancing
- Giám sát hệ thống qua InfluxDB
