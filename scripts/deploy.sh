#!/bin/bash

echo "🚀 Deploying Game Room Distributed System..."

# Build and start services
echo "📦 Building Docker images..."
docker-compose build

echo "🔧 Starting services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 30

# Health check
echo "🏥 Performing health checks..."
for port in 3001 3002 3003; do
    if curl -f http://localhost:$port/api/health > /dev/null 2>&1; then
        echo "✅ App instance on port $port is healthy"
    else
        echo "❌ App instance on port $port is not responding"
    fi
done

# Check InfluxDB instances
for port in 8086 8087 8088; do
    if curl -f http://localhost:$port/health > /dev/null 2>&1; then
        echo "✅ InfluxDB on port $port is healthy"
    else
        echo "❌ InfluxDB on port $port is not responding"
    fi
done

# Check Nginx
if curl -f http://localhost/health > /dev/null 2>&1; then
    echo "✅ Nginx load balancer is healthy"
else
    echo "❌ Nginx load balancer is not responding"
fi

# Check Grafana
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Grafana is accessible"
else
    echo "❌ Grafana is not responding"
fi

echo ""
echo "🎉 Deployment completed!"
echo "📊 Access points:"
echo "   - Main Application: http://localhost"
echo "   - Grafana Dashboard: http://localhost:3000 (admin/admin123)"
echo "   - InfluxDB 1: http://localhost:8086"
echo "   - InfluxDB 2: http://localhost:8087"
echo "   - InfluxDB 3: http://localhost:8088"
echo ""
echo "🧪 Run stress test with: npm run stress-test"
