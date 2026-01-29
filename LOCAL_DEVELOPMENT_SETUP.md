# AVR Local Development Setup Guide

This guide will help you set up the complete AVR (Agent Voice Response) application locally for development.

## Prerequisites

Before starting, ensure you have the following installed:

1. **Node.js 18+** and **npm 9+**
   - Check versions: `node --version` and `npm --version`
   - Download from: https://nodejs.org/

2. **Docker Desktop** (for running agent containers)
   - Download from: https://www.docker.com/products/docker-desktop
   - Ensure Docker is running before starting services

3. **Git** (for cloning repositories)
   - Download from: https://git-scm.com/

## Project Structure

```
AVR Multiple Campaigns/
├── avr-app/              # Admin panel (Frontend + Backend)
│   ├── frontend/         # Next.js frontend
│   └── backend/          # NestJS backend
├── avr-infra/            # Infrastructure services
├── avr-sts-deepgram/     # Deepgram STS service
├── avr-asterisk/         # Asterisk PBX
├── avr-ami/             # AMI service
├── avr-webhook/          # Webhook service
└── avr-phone/            # WebRTC phone client
```

## Step 1: Install Dependencies

### Backend Dependencies

```bash
cd avr-app/backend
npm install
```

### Frontend Dependencies

```bash
cd avr-app/frontend
npm install
```

## Step 2: Configure Environment Variables

### Backend Configuration

Create `avr-app/backend/.env`:

```env
# Database
DB_PATH=./data/avr.db

# JWT
JWT_SECRET=your-secret-key-change-this-in-production
JWT_EXPIRES_IN=7d

# Server
PORT=3001
FRONTEND_URL=http://localhost:3000

# Docker
DOCKER_SOCKET_PATH=/var/run/docker.sock

# Asterisk ARI
ARI_URL=http://localhost:8088/ari
ARI_USERNAME=asterisk
ARI_PASSWORD=asterisk

# Webhooks
WEBHOOK_URL=http://localhost:3001/webhooks
WEBHOOK_SECRET=your-webhook-secret-change-this

# AMI
AMI_URL=http://localhost:6006
```

### Frontend Configuration

Create `avr-app/frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WEBRTC_CLIENT_URL=http://localhost:3000/phone
```

## Step 3: Start Development Services

### Option A: Start Backend and Frontend Separately (Recommended for Development)

**Terminal 1 - Backend:**
```bash
cd avr-app/backend
npm run start:dev
```
Backend will run on: http://localhost:3001

**Terminal 2 - Frontend:**
```bash
cd avr-app/frontend
npm run start:dev
```
Frontend will run on: http://localhost:3000

### Option B: Use Docker Compose (Full Stack)

If you want to run everything including Asterisk and other services:

```bash
cd avr-infra
docker-compose -f docker-compose-app.yml up -d
```

## Step 4: Access the Application

1. **Frontend**: Open http://localhost:3000 in your browser
2. **Backend API**: http://localhost:3001
3. **API Documentation**: http://localhost:3001/api (if available)

## Step 5: Initial Setup

1. **Create Admin User**: 
   - First time access will likely require creating an admin account
   - Check backend logs for default credentials or registration endpoint

2. **Configure Providers**:
   - Go to Providers section
   - Add your API keys (Deepgram, OpenAI, etc.)
   - Create provider configurations

3. **Create Agents**:
   - Go to Agents section
   - Create a new agent
   - Assign providers (ASR, LLM, TTS, or STS)

## Development Workflow

### Making Changes

1. **Backend Changes**:
   - Edit files in `avr-app/backend/src/`
   - Backend auto-reloads on save (watch mode)
   - Check terminal for compilation errors

2. **Frontend Changes**:
   - Edit files in `avr-app/frontend/app/` or `avr-app/frontend/lib/`
   - Frontend auto-reloads on save (Next.js hot reload)
   - Check browser console for errors

### Testing Changes

1. **Backend API Testing**:
   - Use Postman, Insomnia, or curl
   - API endpoints: http://localhost:3001/api/...

2. **Frontend Testing**:
   - Open browser DevTools (F12)
   - Check Console and Network tabs
   - Use React DevTools extension

### Database

- SQLite database is stored in `avr-app/backend/data/avr.db`
- To reset: Delete the database file and restart backend
- Database schema is managed by TypeORM migrations

## Troubleshooting

### Port Already in Use

If port 3000 or 3001 is already in use:

**Backend:**
```bash
# Change PORT in avr-app/backend/.env
PORT=3002
```

**Frontend:**
```bash
# Change port in avr-app/frontend/package.json
"start:dev": "next dev -p 3002"
```

### Docker Issues

- Ensure Docker Desktop is running
- Check Docker daemon: `docker ps`
- Restart Docker if needed

### Database Issues

- Ensure `avr-app/backend/data/` directory exists
- Check file permissions
- Delete `avr.db` and restart to reset

### Module Not Found Errors

```bash
# Reinstall dependencies
cd avr-app/backend && rm -rf node_modules && npm install
cd avr-app/frontend && rm -rf node_modules && npm install
```

## Next Steps

Once local development is complete:

1. Test all features locally
2. Fix any bugs or issues
3. Build production versions
4. Deploy to cloud server

## Useful Commands

```bash
# Backend
cd avr-app/backend
npm run start:dev      # Development mode
npm run build          # Build for production
npm run start:prod     # Production mode
npm run lint           # Lint code
npm run test           # Run tests

# Frontend
cd avr-app/frontend
npm run start:dev      # Development mode
npm run build          # Build for production
npm run start          # Production mode
npm run lint           # Lint code
```

## Support

- **Documentation**: https://wiki.agentvoiceresponse.com/en/home
- **Discord**: https://discord.gg/DFTU69Hg74
- **GitHub**: https://github.com/agentvoiceresponse

