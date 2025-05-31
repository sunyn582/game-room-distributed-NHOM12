# Nhóm 12 - Game Room Distributed System with InfluxDB

## 📋 Tổng quan dự án

Game Room Distributed System là một hệ thống phân tán được thiết kế để quản lý và giám sát các phòng game. Hệ thống sử dụng kiến trúc microservices với nhiều container độc lập, cho phép khả năng mở rộng cao và khả năng chịu lỗi tốt. **InfluxDB** là công cụ chính được sử dụng làm cơ sở dữ liệu time-series để lưu trữ và phân tích dữ liệu game theo thời gian thực, kết hợp với Grafana để giám sát và visualization.

## 🏗️ Kiến trúc hệ thống

```
┌─────────────┐     ┌─────────────┐
│    Client   │────▶│    Nginx    │
└─────────────┘     └──────┬──────┘
                           │
                           ▼
     ┌───────────────────────────────────┐
     │                                   │
┌────▼─────┐   ┌────▼─────┐        ┌────▼─────┐
│  API-1   │   │  API-2   │  ...   │  API-n   │
└────┬─────┘   └────┬─────┘        └────┬─────┘
     │              │                   │
     └──────────────┼───────────────────┘
                    │
                    ▼
     ┌───────────────────────────────────┐
     │          InfluxDB Cluster         │
┌────▼─────┐   ┌────▼─────┐        ┌────▼─────┐
│InfluxDB-1│   │InfluxDB-2│  ...   │InfluxDB-n│
└────┬─────┘   └────┬─────┘        └────┬─────┘
     │              │                   │
     └──────────────┼───────────────────┘
                    │
                    ▼
              ┌────▼─────┐
              │  Grafana │
              └──────────┘
```

## 🛠️ Công nghệ và công cụ sử dụng

### 🎯 Công cụ chính - InfluxDB

**InfluxDB** là trái tim của hệ thống, được chọn làm cơ sở dữ liệu chính vì những lý do sau:

#### Tại sao chọn InfluxDB?
- **Time-Series Database**: Được thiết kế đặc biệt cho dữ liệu theo thời gian (timestamps)
- **High Performance**: Tối ưu hóa cho việc ghi và đọc dữ liệu với volume lớn
- **Compression**: Nén dữ liệu hiệu quả, tiết kiệm storage
- **SQL-like Query Language**: InfluxQL dễ học và sử dụng
- **Built-in Functions**: Hỗ trợ aggregation, downsampling, retention policies
- **Clustering Support**: Khả năng mở rộng horizontal

#### Ứng dụng InfluxDB trong dự án:
```sql
-- Ví dụ schema cho game room data
CREATE DATABASE game_rooms

-- Measurement cho player statistics
SELECT mean("score"), max("level") 
FROM "player_stats" 
WHERE time >= now() - 1h 
GROUP BY time(5m), "room_id"

-- Measurement cho room performance
SELECT count("connections"), mean("response_time")
FROM "room_metrics"
WHERE time >= now() - 24h
GROUP BY time(1h)
```

#### Cấu hình InfluxDB Cluster:
```yaml
# docker-compose.yml
influxdb-1:
  image: influxdb:2.7
  environment:
    - INFLUXDB_DB=game_rooms
    - INFLUXDB_ADMIN_USER=admin
    - INFLUXDB_ADMIN_PASSWORD=admin123
    - INFLUXDB_HTTP_AUTH_ENABLED=true
  volumes:
    - influxdb1-storage:/var/lib/influxdb
  ports:
    - "8086:8086"

influxdb-2:
  image: influxdb:2.7
  environment:
    - INFLUXDB_DB=game_rooms
    - INFLUXDB_ADMIN_USER=admin
    - INFLUXDB_ADMIN_PASSWORD=admin123
    - INFLUXDB_HTTP_AUTH_ENABLED=true
  volumes:
    - influxdb2-storage:/var/lib/influxdb
  ports:
    - "8087:8086"
```

### 🔧 Công cụ hỗ trợ

#### **Grafana** - Visualization & Monitoring
- **Mục đích**: Tạo dashboard và giám sát real-time
- **Tích hợp**: Kết nối trực tiếp với InfluxDB
- **Tính năng**:
  - Real-time dashboards
  - Alerting system
  - Multiple data source support
  - Custom panels và visualizations

```yaml
# Grafana configuration
grafana:
  image: grafana/grafana:latest
  environment:
    - GF_SECURITY_ADMIN_USER=admin
    - GF_SECURITY_ADMIN_PASSWORD=admin
    - GF_INSTALL_PLUGINS=grafana-influxdb-datasource
  volumes:
    - grafana-storage:/var/lib/grafana
    - ./grafana/provisioning:/etc/grafana/provisioning
```

#### **Nginx** - Load Balancer & Reverse Proxy
- **Mục đích**: Phân phối tải và routing requests
- **Tính năng**:
  - Load balancing algorithms (round-robin, least-connections)
  - SSL termination
  - Rate limiting
  - Health checks

```nginx
# nginx.conf
upstream api_servers {
    least_conn;
    server api-1:3000 max_fails=3 fail_timeout=30s;
    server api-2:3000 max_fails=3 fail_timeout=30s;
    server api-3:3000 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    location /api/ {
        proxy_pass http://api_servers;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

#### **Docker & Docker Compose** - Containerization
- **Mục đích**: Container orchestration và deployment
- **Lợi ích**:
  - Consistent environments
  - Easy scaling
  - Service isolation
  - Resource management

#### **Node.js & Express.js** - Backend API
- **Mục đích**: RESTful API development
- **Tính năng**:
  - Async/await support
  - Middleware ecosystem
  - JSON handling
  - WebSocket support

```javascript
// API endpoint example
app.post('/api/rooms/:id/metrics', async (req, res) => {
  const { roomId } = req.params;
  const { playerCount, avgResponseTime } = req.body;
  
  // Write to InfluxDB
  await influxDB.writePoints([{
    measurement: 'room_metrics',
    tags: { room_id: roomId },
    fields: { 
      player_count: playerCount,
      avg_response_time: avgResponseTime 
    },
    timestamp: new Date()
  }]);
  
  res.json({ success: true });
});
```

### 📊 Data Flow với InfluxDB

```
Game Events → API Servers → InfluxDB → Grafana Dashboard
     ↓              ↓           ↓            ↓
Player Actions   Validation   Storage    Visualization
Room Updates     Processing   Querying   Alerting
Metrics Data     Batching     Analysis   Reporting
```

#### Các loại dữ liệu được lưu trong InfluxDB:

1. **Player Metrics**:
   - Score progression
   - Level achievements
   - Session duration
   - Action frequency

2. **Room Performance**:
   - Connection count
   - Response times
   - Error rates
   - Resource usage

3. **System Metrics**:
   - API throughput
   - Database performance
   - Memory usage
   - Network latency

### 🔍 Monitoring Stack

```
Application Metrics → InfluxDB → Grafana → Alerts
System Metrics → InfluxDB → Grafana → Notifications
Custom Events → InfluxDB → Grafana → Reports
```

## 🚀 Cài đặt và chạy

### Yêu cầu hệ thống
- Docker và Docker Compose
- Node.js (phiên bản 14+)
- Git
- RAM tối thiểu: 4GB (khuyến nghị 8GB cho InfluxDB)
- Disk space: 5GB (cho InfluxDB data)
- Network: Port 8086 (InfluxDB), 3000 (Grafana), 8080 (API)

### Các bước cài đặt

1. **Clone repository:**
```bash
git clone https://github.com/sunyn582/game-room-distributed-NHOM12.git
cd game-room-distributed-NHOM12
```

2. **Cấu hình InfluxDB:**
```bash
# Tạo file cấu hình InfluxDB
mkdir -p ./influxdb/config
cp ./config/influxdb.conf.example ./influxdb/config/influxdb.conf

# Chỉnh sửa cấu hình nếu cần
nano ./influxdb/config/influxdb.conf
```

3. **Cấu hình môi trường:**
```bash
cp .env.example .env
# Chỉnh sửa file .env với thông tin InfluxDB
```

4. **Khởi động InfluxDB cluster:**
```bash
# Khởi động InfluxDB instances
docker-compose up -d influxdb-1 influxdb-2

# Kiểm tra InfluxDB
curl -i http://localhost:8086/ping
```

5. **Khởi động toàn bộ hệ thống:**
```bash
docker-compose up -d
```

6. **Cấu hình Grafana với InfluxDB:**
```bash
# Truy cập Grafana
open http://localhost:3000

# Thêm InfluxDB datasource:
# URL: http://influxdb-1:8086
# Database: game_rooms
# User: admin
# Password: admin123
```

### Kiểm tra cài đặt

```bash
# Kiểm tra InfluxDB
curl -G http://localhost:8086/query --data-urlencode "q=SHOW DATABASES"

# Kiểm tra API connectivity với InfluxDB
curl http://localhost:8080/api/health/influxdb

# Kiểm tra Grafana
curl http://localhost:3000/api/health
```

## ✨ Tính năng chính

### 🎮 Quản lý phòng game với InfluxDB
- **Real-time metrics**: Lưu trữ metrics game theo thời gian thực
- **Player analytics**: Phân tích hành vi người chơi
- **Performance monitoring**: Theo dõi hiệu năng phòng game
- **Historical data**: Lưu trữ lịch sử dài hạn cho analysis

### 📊 Analytics với InfluxDB
```sql
-- Top performing rooms
SELECT mean("score") as avg_score, "room_id"
FROM "player_stats" 
WHERE time >= now() - 7d 
GROUP BY "room_id" 
ORDER BY avg_score DESC 
LIMIT 10

-- Peak hours analysis
SELECT count("connections") as total_connections
FROM "room_metrics"
WHERE time >= now() - 30d
GROUP BY time(1h)
ORDER BY total_connections DESC
```

### 🔄 Data Retention Policies
```sql
-- Tạo retention policies cho InfluxDB
CREATE RETENTION POLICY "one_week" ON "game_rooms" 
DURATION 7d REPLICATION 1 DEFAULT

CREATE RETENTION POLICY "one_month" ON "game_rooms" 
DURATION 30d REPLICATION 1

CREATE RETENTION POLICY "one_year" ON "game_rooms" 
DURATION 365d REPLICATION 1
```

## 📈 Ưu điểm và nhược điểm

### ✅ Ưu điểm

1. **InfluxDB Performance**
   - Ghi dữ liệu với tốc độ cao (hàng triệu points/second)
   - Query performance tối ưu cho time-series data
   - Automatic data compression và retention

2. **Scalability với InfluxDB**
   - Horizontal scaling với clustering
   - Sharding data theo time ranges
   - Load balancing cho read/write operations

3. **Real-time Analytics**
   - Continuous queries cho real-time aggregation
   - Streaming data processing
   - Low-latency queries

4. **Data Integrity**
   - ACID compliance cho single-node writes
   - Replication cho high availability
   - Backup và restore capabilities

### ⚠️ Nhược điểm

1. **InfluxDB Limitations**
   - Không hỗ trợ JOINs phức tạp
   - Limited secondary indexing
   - Memory usage cao cho large cardinality

2. **Complexity**
   - Cần hiểu biết về time-series concepts
   - Query optimization cần kinh nghiệm
   - Clustering setup phức tạp

3. **Monitoring Overhead**
   - Cần monitor InfluxDB performance
   - Disk space management cho retention
   - Memory tuning cho optimal performance

## 🧪 Testing với InfluxDB

### Performance Testing
```bash
# Test InfluxDB write performance
./scripts/influx-write-test.sh --points 1000000 --batch-size 5000

# Test query performance
./scripts/influx-query-test.sh --concurrent 10 --duration 60s

# Stress test toàn hệ thống
./scripts/full-system-test.sh --users 1000 --duration 300s
```

### Data Validation
```bash
# Kiểm tra data consistency
./scripts/validate-influx-data.sh

# Backup test
./scripts/backup-restore-test.sh
```

## 📊 Monitoring và Logging

### InfluxDB Monitoring
- **Internal metrics**: _internal database
- **Performance metrics**: Query execution time, memory usage
- **Storage metrics**: Disk usage, compression ratio
- **Network metrics**: Read/write throughput

### Grafana Dashboards cho InfluxDB
1. **InfluxDB Overview**: System health, performance metrics
2. **Query Performance**: Slow queries, execution times
3. **Storage Analytics**: Disk usage, retention policies
4. **Game Analytics**: Player metrics, room performance

## 🔮 Hướng phát triển tương lai

### Phase 1: InfluxDB Optimization
- [ ] Implement InfluxDB clustering với Enterprise features
- [ ] Optimize retention policies và continuous queries
- [ ] Add InfluxDB monitoring với Telegraf
- [ ] Implement backup automation

### Phase 2: Advanced Analytics
- [ ] Machine learning với InfluxDB data
- [ ] Predictive analytics cho game trends
- [ ] Real-time anomaly detection
- [ ] Advanced visualization với custom Grafana plugins

### Phase 3: Enterprise Features
- [ ] InfluxDB Enterprise clustering
- [ ] Multi-tenant architecture
- [ ] Advanced security với authentication
- [ ] Disaster recovery setup

## 📁 Cấu trúc thư mục

```
game-room-distributed-NHOM12/
├── api/                     # API service source code
│   ├── controllers/         # API controllers
│   ├── models/             # Data models
│   ├── routes/             # API routes
│   ├── middleware/         # Custom middleware
│   └── influxdb/           # InfluxDB integration
│       ├── client.js       # InfluxDB client setup
│       ├── queries.js      # Common queries
│       └── schemas.js      # Data schemas
├── influxdb/               # InfluxDB configuration
│   ├── config/            # InfluxDB config files
│   ├── scripts/           # Database scripts
│   └── backups/           # Backup files
├── grafana/               # Grafana configuration
│   ├── dashboards/        # Dashboard definitions
│   ├── datasources/       # Datasource configs
│   └── provisioning/      # Auto-provisioning
├── scripts/               # Utility và test scripts
│   ├── influx-setup.sh    # InfluxDB setup script
│   ├── stress-test.sh     # Load testing script
│   └── backup.sh          # Backup script
├── .env                   # Environment variables
├── docker-compose.yml     # Docker Compose configuration
└── README.md             # Project documentation
```

## 🤝 Đóng góp

### InfluxDB Best Practices
- Sử dụng appropriate field types
- Optimize tag cardinality
- Implement proper retention policies
- Monitor query performance

### Development Guidelines
- Test với InfluxDB sandbox trước khi deploy
- Document tất cả measurements và fields
- Implement proper error handling cho InfluxDB operations
- Use batch writes cho better performance

## 👥 Thành viên nhóm

| Tên | GitHub | Vai trò | Chuyên môn |
|-----|--------|---------|------------|
| Võ Văn Sơn | [@sunyn582](https://github.com/sunyn582) | Team Lead, Backend Developer | InfluxDB, Node.js |
| EchoHuyn | [@EchoHuyn](https://github.com/EchoHuyn) | Frontend Developer, DevOps | Grafana, Docker |

## 📄 License

MIT License - xem file [LICENSE](LICENSE) để biết thêm chi tiết.

## 📞 Hỗ trợ

### InfluxDB Support
- [InfluxDB Documentation](https://docs.influxdata.com/)
- [InfluxDB Community](https://community.influxdata.com/)
- [InfluxDB GitHub](https://github.com/influxdata/influxdb)

### Project Support
Nếu bạn gặp vấn đề hoặc có câu hỏi:
1. Tạo issue trên GitHub
2. Liên hệ qua email: [your-email@example.com]
3. Join Discord server: [link-to-discord]

---

**Lưu ý**: Dự án này tập trung vào việc sử dụng InfluxDB làm công cụ chính cho hệ thống phân tán. Tất cả các thành phần khác được thiết kế để hỗ trợ và tối ưu hóa việc sử dụng InfluxDB.

## 🏆 Acknowledgments

- **InfluxData** cho việc phát triển InfluxDB
- **Grafana Labs** cho Grafana visualization platform
- Cảm ơn giảng viên đã hướng dẫn về distributed systems
- Cộng đồng InfluxDB và time-series database
```
```

