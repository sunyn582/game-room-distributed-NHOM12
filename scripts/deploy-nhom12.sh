#!/bin/bash

echo "🚀 Deploying Nhóm 12 Game Room System..."

# Kiểm tra Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker chưa được cài đặt!"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose chưa được cài đặt!"
    exit 1
fi

# Tạo thư mục logs
mkdir -p logs

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose down

# Build và start services
echo "🔨 Building and starting services..."
docker-compose up --build -d

# Đợi InfluxDB khởi động
echo "⏳ Waiting for InfluxDB to start..."
sleep 30

# Kiểm tra health của services
echo "🔍 Checking service health..."

# Kiểm tra InfluxDB
if curl -f http://localhost:8086/health > /dev/null 2>&1; then
    echo "✅ InfluxDB is healthy"
else
    echo "❌ InfluxDB is not responding"
fi

# Kiểm tra app instances
for port in 3001 3002 3003; do
    if curl -f http://localhost:$port > /dev/null 2>&1; then
        echo "✅ App instance on port $port is healthy"
    else
        echo "❌ App instance on port $port is not responding"
    fi
done

# Kiểm tra Nginx
if curl -f http://localhost > /dev/null 2>&1; then
    echo "✅ Nginx load balancer is healthy"
else
    echo "❌ Nginx load balancer is not responding"
fi

echo ""
echo "🎉 Nhóm 12 Game Room System deployed successfully!"
echo ""
echo "📱 Access URLs:"
echo "   - Main App: http://localhost"
echo "   - InfluxDB UI: http://localhost:8086"
echo "   - Instance 1: http://localhost:3001"
echo "   - Instance 2: http://localhost:3002" 
echo "   - Instance 3: http://localhost:3003"
echo ""
echo "🔑 InfluxDB Credentials:"
echo "   - Username: admin"
echo "   - Password: password123"
echo "   - Organization: nhom_12"
echo "   - Bucket: wed-game"
echo ""
echo "📊 Monitoring:"
echo "   - Stats API: http://localhost/api/nhom12/stats"
echo "   - Top Rooms: http://localhost/api/nhom12/top-rooms"
echo "   - Instances: http://localhost/api/nhom12/instances"
