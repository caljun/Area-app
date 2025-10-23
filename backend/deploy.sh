#!/bin/bash

# Production deployment script with memory optimization

echo "🚀 Starting production deployment..."

# Set memory limits for Node.js
export NODE_OPTIONS="--max-old-space-size=1024"

# Build the TypeScript project
echo "📦 Building TypeScript project..."
npm run build

# Generate Prisma client
echo "🗄️ Generating Prisma client..."
npx prisma generate

# Start the production server
echo "🌟 Starting production server..."
npm run start:prod
