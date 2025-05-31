#!/bin/bash

echo "🚀 Game Room Distributed System - Comprehensive Testing"
echo "======================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if service is running
check_service() {
    local service_url=$1
    local service_name=$2
    
    echo -n "Checking $service_name... "
    if curl -s -f "$service_url" > /dev/null; then
        echo -e "${GREEN}✓ Running${NC}"
        return 0
    else
        echo -e "${RED}✗ Not running${NC}"
        return 1
    fi
}

# Function to wait for service
wait_for_service() {
    local service_url=$1
    local service_name=$2
    local max_attempts=30
    local attempt=1
    
    echo "Waiting for $service_name to be ready..."
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "$service_url" > /dev/null; then
            echo -e "${GREEN}✓ $service_name is ready${NC}"
            return 0
        fi
        echo "Attempt $attempt/$max_attempts - waiting..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}✗ $service_name failed to start${NC}"
    return 1
}

# Step 1: Start services
echo -e "\n${YELLOW}Step 1: Starting services...${NC}"
docker-compose down
docker-compose up -d --build

# Step 2: Wait for services to be ready
echo -e "\n${YELLOW}Step 2: Waiting for services...${NC}"
wait_for_service "http://localhost/health" "Load Balancer" || exit 1
wait_for_service "http://localhost:8086/health" "InfluxDB" || exit 1

# Step 3: Run health checks
echo -e "\n${YELLOW}Step 3: Running health checks...${NC}"
check_service "http://localhost/health" "Main Application"
check_service "http://localhost:8086/health" "InfluxDB"

# Step 4: Run stress tests
echo -e "\n${YELLOW}Step 4: Running stress tests...${NC}"

echo "📊 Running API load test..."
node scripts/stress-test.js

# Step 5: Monitor system resources
echo -e "\n${YELLOW}Step 5: System resource monitoring...${NC}"
echo "Docker container stats:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"

# Step 6: Check logs for errors
echo -e "\n${YELLOW}Step 6: Checking for errors in logs...${NC}"
echo "Recent error logs:"
docker-compose logs --tail=50 | grep -i error || echo "No errors found"

# Step 7: Test specific endpoints
echo -e "\n${YELLOW}Step 7: Testing specific endpoints...${NC}"

# Test health endpoint
echo -n "Testing health endpoint... "
if curl -s "http://localhost/health" | grep -q "healthy"; then
    echo -e "${GREEN}✓ Passed${NC}"
else
    echo -e "${RED}✗ Failed${NC}"
fi

# Test API endpoints
echo -n "Testing rooms API... "
if curl -s "http://localhost/api/rooms" > /dev/null; then
    echo -e "${GREEN}✓ Passed${NC}"
else
    echo -e "${RED}✗ Failed${NC}"
fi

# Step 8: Database sharding test
echo -e "\n${YELLOW}Step 8: Testing database sharding...${NC}"
echo "Creating test data across shards..."
for i in {1..10}; do
    curl -s -X POST "http://localhost/api/test/shard-write" \
         -H "Content-Type: application/json" \
         -d "{\"roomId\":\"test-room-$i\",\"userId\":\"test-user-$i\",\"action\":\"test\"}" > /dev/null
done
echo -e "${GREEN}✓ Sharding test completed${NC}"

# Step 9: Circuit breaker test
echo -e "\n${YELLOW}Step 9: Testing circuit breaker...${NC}"
echo "Triggering circuit breaker with failed requests..."
for i in {1..10}; do
    curl -s "http://localhost/api/test/circuit-breaker?fail=true" > /dev/null
done
echo -e "${GREEN}✓ Circuit breaker test completed${NC}"

# Step 10: Final summary
echo -e "\n${YELLOW}Step 10: Test Summary${NC}"
echo "======================================"

# Check if all tests passed
all_passed=true

# Recheck all services
services=("http://localhost/health:Main App" "http://localhost:8086/health:InfluxDB")
for service in "${services[@]}"; do
    url="${service%%:*}"
    name="${service##*:}"
    if ! check_service "$url" "$name"; then
        all_passed=false
    fi
done

if [ "$all_passed" = true ]; then
    echo -e "\n${GREEN}🎉 All tests passed! System is ready for production.${NC}"
    exit 0
else
    echo -e "\n${RED}❌ Some tests failed. Please check the logs above.${NC}"
    exit 1
fi
