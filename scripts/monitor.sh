#!/bin/bash

echo "📊 Game Room System Monitoring"
echo "=============================="

while true; do
    clear
    echo "📊 Game Room System Status - $(date)"
    echo "=============================="
    
    # Check application instances
    echo "🖥️  Application Instances:"
    for port in 3001 3002 3003; do
        if curl -s http://localhost:$port/api/health > /dev/null 2>&1; then
            echo "   ✅ App$((port-3000)) (port $port) - HEALTHY"
        else
            echo "   ❌ App$((port-3000)) (port $port) - DOWN"
        fi
    done
    
    echo ""
    echo "🗄️  InfluxDB Instances:"
    for port in 8086 8087 8088; do
        if curl -s http://localhost:$port/health > /dev/null 2>&1; then
            echo "   ✅ InfluxDB$((port-8085)) (port $port) - HEALTHY"
        else
            echo "   ❌ InfluxDB$((port-8085)) (port $port) - DOWN"
        fi
    done
    
    echo ""
    echo "🔧 Infrastructure:"
    if curl -s http://localhost/health > /dev/null 2>&1; then
        echo "   ✅ Nginx Load Balancer - HEALTHY"
    else
        echo "   ❌ Nginx Load Balancer - DOWN"
    fi
    
    if curl -s http://localhost:6379 > /dev/null 2>&1; then
        echo "   ✅ Redis - HEALTHY"
    else
        echo "   ❌ Redis - DOWN"
    fi
    
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo "   ✅ Grafana - HEALTHY"
    else
        echo "   ❌ Grafana - DOWN"
    fi
    
    echo ""
    echo "📈 System Resources:"
    echo "   CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)%"
    echo "   Memory: $(free | grep Mem | awk '{printf("%.1f%%", $3/$2 * 100.0)}')"
    echo "   Docker Containers: $(docker ps --format "table {{.Names}}\t{{.Status}}" | grep -c "Up")/$(docker ps -a --format "table {{.Names}}" | wc -l | awk '{print $1-1}')"
    
    echo ""
    echo "Press Ctrl+C to exit monitoring..."
    sleep 5
done
