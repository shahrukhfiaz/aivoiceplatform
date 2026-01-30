#!/bin/bash
# Production Deployment Script - Run this before deploying

echo "=== DSAI Production Deployment ==="
echo ""

# 1. Rebuild Backend
echo "1. Building backend..."
cd "dsai-app/backend"
npm run build
docker build -t agentvoiceresponse/dsai-app-backend:latest .
echo "✅ Backend built"
echo ""

# 2. Rebuild STS Container  
echo "2. Building STS container..."
cd "../../dsai-sts-deepgram"
docker build -t agentvoiceresponse/dsai-sts-deepgram:latest .
echo "✅ STS container built"
echo ""

# 3. Push to Docker Hub (optional - for production)
echo "3. Push to Docker Hub? (y/n)"
read -r push_choice
if [ "$push_choice" = "y" ]; then
    docker push agentvoiceresponse/dsai-app-backend:latest
    docker push agentvoiceresponse/dsai-sts-deepgram:latest
    echo "✅ Images pushed to Docker Hub"
fi

echo ""
echo "=== Deployment Ready ==="
echo "All source code changes have been compiled and containerized."
echo "The system will automatically:"
echo "  - Use :local images when available"
echo "  - Update Asterisk configs when agents restart"
echo "  - Fetch provider configs in real-time from database"
