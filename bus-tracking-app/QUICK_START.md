# 🚀 Quick Start Guide

## Prerequisites Check

Before starting, ensure you have:
- ✅ Node.js 20+ installed (`node --version`)
- ✅ PostgreSQL 15+ installed and running
- ✅ Redis installed and running (optional for development)

## Step-by-Step Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Set Up Database

**Option A: Using Docker (Easiest)**
```bash
# From project root
docker-compose up -d postgres redis
```

**Option B: Local PostgreSQL**
```bash
# Create database
createdb bus_tracking

# Connect and enable PostGIS
psql bus_tracking
CREATE EXTENSION postgis;
\q
```

### 3. Configure Environment

```bash
cd backend
cp .env.example .env
```

Edit `.env` and update:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bus_tracking?schema=public"
REDIS_HOST=localhost
REDIS_PORT=6379

# Generate secure secrets (use: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_ACCESS_SECRET=your-generated-secret-here
JWT_REFRESH_SECRET=your-generated-refresh-secret-here
```

### 4. Initialize Database

```bash
# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate dev --name init

# (Optional) Seed database with sample data
npx prisma db seed
```

### 5. Start Development Server

```bash
npm run dev
```

Server should start at: **http://localhost:5000**

### 6. Test the API

```bash
# Health check
curl http://localhost:5000/health

# Should return: {"success":true,"message":"Server is running","timestamp":"..."}
```

## Creating Your First Admin User

Use an API client (Postman, Thunder Client, or curl):

```bash
POST http://localhost:5000/api/auth/register/admin
Content-Type: application/json

{
  "email": "admin@college.edu",
  "password": "Admin@123456"
}
```

## Next Steps

1. **Register a Student**
   ```bash
   POST /api/auth/register/student
   ```

2. **Login**
   ```bash
   POST /api/auth/login
   ```

3. **Test Real-time Features**
   - Connect to Socket.IO at `ws://localhost:5000`
   - Use the access token for authentication

## Common Issues

### Port 5000 Already in Use
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:5000 | xargs kill -9
```

### Database Connection Error
- Check PostgreSQL is running: `pg_isready`
- Verify DATABASE_URL in .env
- Ensure database exists: `psql -l | grep bus_tracking`

### Redis Connection Error
- Check Redis is running: `redis-cli ping`
- If not using Redis, comment out Redis-related code in development

## Development Commands

```bash
# Start dev server with auto-reload
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run Prisma Studio (Database GUI)
npx prisma studio

# Generate Prisma Client
npx prisma generate

# Create new migration
npx prisma migrate dev --name your_migration_name

# Format code
npm run format

# Lint code
npm run lint
```

## Testing the Complete Flow

### 1. Student Registration & Login
```javascript
// Register
POST /api/auth/register/student
{
  "email": "student@college.edu",
  "password": "Student@123",
  "fullName": "John Doe",
  "rollNumber": "CS2024001",
  "department": "Computer Science",
  "semester": 5,
  "phoneNumber": "+919876543210"
}

// Login
POST /api/auth/login
{
  "email": "student@college.edu",
  "password": "Student@123"
}
// Save the accessToken from response
```

### 2. Connect to Socket.IO
```javascript
const socket = io('http://localhost:5000', {
  auth: {
    token: 'your-access-token-here'
  }
});

socket.on('connect', () => {
  console.log('Connected!');
});
```

### 3. Test Pickup Pin (Student)
```javascript
socket.emit('student:pin-location', {
  lat: 12.9716,
  lng: 77.5946,
  address: 'Near College Gate'
});

socket.on('pickup:confirmed', (data) => {
  console.log('Pickup confirmed:', data);
});
```

### 4. Test Location Update (Driver)
```javascript
// First, create a driver and assign a bus via admin

socket.emit('driver:location-update', {
  busId: 'bus-uuid-here',
  lat: 12.9716,
  lng: 77.5946,
  speed: 30,
  accuracy: 10
});
```

## Project Structure Overview

```
backend/
├── src/
│   ├── config/       → Database, Redis, Socket.IO setup
│   ├── modules/      → Feature modules (auth, students, etc.)
│   ├── middleware/   → Auth, validation, error handling
│   ├── sockets/      → Real-time event handlers
│   ├── utils/        → Helper functions
│   ├── app.ts        → Express app configuration
│   └── server.ts     → Server entry point
├── prisma/
│   └── schema.prisma → Database schema
└── package.json
```

## What's Implemented So Far

✅ **Core Infrastructure**
- Express server with TypeScript
- PostgreSQL with Prisma ORM
- Redis caching
- Socket.IO for real-time features
- JWT authentication
- Role-based authorization
- Rate limiting
- Error handling

✅ **Authentication Module**
- Student registration
- Driver registration (admin only)
- Admin registration
- Login/Logout
- Token refresh
- Password change

✅ **Real-time Tracking**
- Driver location updates
- Student bus requests
- Admin tracking dashboard
- Location spoof detection

✅ **Pickup Management**
- Student pickup pin creation
- Fee status validation
- Driver pickup view
- Pickup completion
- Attendance tracking

## What's Next

🚧 **To Be Implemented**
- Payment integration (Razorpay)
- Notification system
- Admin dashboard APIs
- Bus management APIs
- Route management
- Analytics endpoints
- Mobile app (React Native)

## Need Help?

- Check the main README.md for detailed documentation
- Review IMPLEMENTATION_PLAN.md for architecture details
- Check Prisma schema for database structure
- Use `npx prisma studio` to inspect database

---

Happy Coding! 🚀
