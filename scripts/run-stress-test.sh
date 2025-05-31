#!/bin/bash
# 5. STRESS TEST SCRIPT

echo "🚀 Starting Game Room Distributed System Stress Test"

# Start the system
echo "📦 Starting services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 30

# Check service health
echo "🏥 Checking service health..."
curl -f http://localhost/health || exit 1

# Run stress tests
echo "🧪 Running stress tests..."

# API Load Test
echo "📊 Testing API load..."
node -e "
const { StressTest } = require('./missing-components/stress-test.js');
const test = new StressTest('http://localhost', 'ws://localhost');
test.testApiLoad(50, 100).then(() => {
  console.log('API stress test completed');
});
"

# WebSocket Load Test
echo "🔌 Testing WebSocket load..."
node -e "
const { StressTest } = require('./missing-components/stress-test.js');
const test = new StressTest('http://localhost', 'ws://localhost');
test.testWebSocketLoad(100).then(() => {
  console.log('WebSocket stress test completed');
});
"

# Monitor system during test
echo "📈 Monitoring system metrics..."
docker stats --no-stream

echo "✅ Stress test completed!"
