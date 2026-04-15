# 🚌College Bus Tracking System

A production-ready, secure, and scalable bus tracking application for college students with real-time GPS tracking, AI-powered routing, and role-based access control.

## 🎯 Features

### For Students
- ✅ Real-time bus location tracking on interactive map
- 📍 "Pick Me Up" feature to pin pickup locations
- 💳 Fee payment integration (Razorpay)
- 🔔 Smart notifications for bus arrival and fee reminders
- 📊 Attendance history
- 🔍 Search buses by route/number

### For Drivers
- 🗺️ Map view with student pickup pins
- 🎨 Color-coded pins (Red = Paid fees, Black = Unpaid)
- 🤖 AI-powered route optimization
- 📱 Real-time pickup requests
- ✅ Mark pickups as complete

### For Admins
- 👥 Complete student, driver, and bus management
- 📍 Live tracking of all buses and students
- 📈 Analytics dashboard
- 💰 Fee management system
- 📊 Attendance reports
- 🔐 Full operational control

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js 20+ with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL with PostGIS
- **Cache**: Redis
- **Real-time**: Socket.IO
- **ORM**: Prisma
- **Authentication**: JWT (Access + Refresh tokens)
- **Validation**: Zod
- **Payment**: Razorpay
- **AI/ML**: TensorFlow.js

### Security
- 🔐 JWT-based authentication
- 🛡️ Role-based access control (RBAC)
- 🔒 Password hashing with bcrypt
- 🚦 Rate limiting
- 🔍 Input validation
- 🌐 CORS protection
- 📝 Audit logging

## 📋 Prerequisites

- Node.js 20+ and npm
- PostgreSQL 15+ (with PostGIS extension)
- Redis 7+
- Docker & Docker Compose (optional, recommended)

## 🚀 Quick Start

### Option 1: Using Docker (Recommended)

1. **Clone the repository**
```bash
git clone <repository-url>
cd bus-tracking-app
```

2. **Set up environment variables**
```bash
cd backend
cp .env.example .env
# Edit .env with your configuration
```

3. **Start all services**
```bash
cd ..
docker-compose up -d
```

4. **Run database migrations**
```bash
docker-compose exec backend npx prisma migrate deploy
```

5. **Access the application**
- Backend API: http://localhost:5000
- Health Check: http://localhost:5000/health

### Option 2: Manual Setup

1. **Install dependencies**
```bash
cd backend
npm install
```

2. **Set up PostgreSQL**
```bash
# Create database
createdb bus_tracking

# Enable PostGIS extension
psql bus_tracking -c "CREATE EXTENSION postgis;"
```

3. **Set up Redis**
```bash
# Start Redis server
redis-server
```

4. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your database and Redis credentials
```

5. **Generate Prisma Client**
```bash
npx prisma generate
```

6. **Run migrations**
```bash
npx prisma migrate dev
```

7. **Start development server**
```bash
npm run dev
```

## 📁 Project Structure

```
bus-tracking-app/
├── backend/
│   ├── src/
│   │   ├── config/          # Configuration files
│   │   │   ├── db.ts        # Database connection
│   │   │   ├── redis.ts     # Redis client
│   │   │   ├── socket.ts    # Socket.IO setup
│   │   │   └── env.ts       # Environment variables
│   │   ├── modules/         # Feature modules
│   │   │   ├── auth/        # Authentication
│   │   │   ├── students/    # Student management
│   │   │   ├── drivers/     # Driver management
│   │   │   ├── buses/       # Bus management
│   │   │   ├── tracking/    # Real-time tracking
│   │   │   ├── pickups/     # Pickup management
│   │   │   ├── payments/    # Payment processing
│   │   │   └── admin/       # Admin operations
│   │   ├── middleware/      # Express middleware
│   │   │   ├── auth.middleware.ts
│   │   │   ├── role.middleware.ts
│   │   │   ├── rateLimiter.ts
│   │   │   └── errorHandler.ts
│   │   ├── services/        # Business logic services
│   │   ├── sockets/         # Socket.IO handlers
│   │   │   ├── tracking.socket.ts
│   │   │   └── pickup.socket.ts
│   │   ├── utils/           # Utility functions
│   │   │   ├── logger.ts
│   │   │   ├── tokenUtils.ts
│   │   │   └── geoUtils.ts
│   │   ├── app.ts           # Express app setup
│   │   └── server.ts        # Server entry point
│   ├── prisma/
│   │   └── schema.prisma    # Database schema
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
├── docker-compose.yml
└── IMPLEMENTATION_PLAN.md
```

## 🔑 API Endpoints

### Authentication
```
POST   /api/auth/login                 # Login
POST   /api/auth/register/student      # Student registration
POST   /api/auth/register/driver       # Driver registration (admin only)
POST   /api/auth/register/admin        # Admin registration (admin only)
POST   /api/auth/refresh               # Refresh access token
POST   /api/auth/logout                # Logout
POST   /api/auth/change-password       # Change password
GET    /api/auth/me                    # Get current user
```

### Students (Coming Soon)
```
GET    /api/students/profile
PUT    /api/students/profile
GET    /api/students/fee-status
```

### Tracking (Coming Soon)
```
GET    /api/tracking/live-buses
GET    /api/tracking/bus/:id
```

### Payments (Coming Soon)
```
POST   /api/payments/initiate
POST   /api/payments/verify
GET    /api/payments/history
```

## 🔌 Socket.IO Events

### Client → Server

**Students:**
- `student:pin-location` - Create pickup pin
- `student:cancel-pin` - Cancel pickup request
- `student:request-buses` - Get live bus locations

**Drivers:**
- `driver:location-update` - Send GPS location
- `driver:pickup-complete` - Mark pickup as complete
- `driver:request-pickups` - Get nearby pickups

**Admins:**
- `admin:request-tracking` - Get all tracking data

### Server → Client

**To Students:**
- `bus:location-update` - Live bus location
- `pickup:confirmed` - Pickup request confirmed
- `bus:eta-update` - Estimated arrival time

**To Drivers:**
- `pickup:new` - New pickup request
- `pickup:cancelled` - Pickup cancelled

**To All:**
- `notification:new` - New notification
- `system:message` - System announcement

## 🗄️ Database Schema

### Key Tables
- **users** - Base user authentication
- **students** - Student profiles and fee status
- **drivers** - Driver information
- **buses** - Bus details and current location
- **routes** - Route paths (GeoJSON)
- **pickup_pins** - Student pickup requests
- **attendance** - Daily boarding records
- **payments** - Fee transactions
- **notifications** - Push notifications
- **location_history** - GPS tracking history

## 🔐 Environment Variables

See `.env.example` for all required environment variables:

```env
# Server
NODE_ENV=development
PORT=5000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/bus_tracking

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_ACCESS_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret

# Google Maps
GOOGLE_MAPS_API_KEY=your-api-key

# Razorpay
RAZORPAY_KEY_ID=your-key-id
RAZORPAY_KEY_SECRET=your-key-secret

# Firebase (for push notifications)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## 📦 Deployment

### Production Build

```bash
# Build TypeScript
npm run build

# Start production server
npm start
```

### Using Docker

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop services
docker-compose down
```

## 🤖 AI Features

1. **Route Optimization** - Suggests optimal pickup sequence
2. **Pickup Clustering** - Groups nearby students
3. **ETA Prediction** - Estimates arrival times
4. **Traffic-Aware Routing** - Adjusts for traffic conditions
5. **Location Spoof Detection** - Prevents fake GPS data
6. **Smart Notifications** - Predictive fee reminders

## 🔒 Security Features

- JWT authentication with token rotation
- Role-based access control (RBAC)
- Password hashing (bcrypt, 12 rounds)
- API rate limiting
- Input validation (Zod schemas)
- SQL injection prevention (Prisma ORM)
- Location spoof detection
- Audit logging for admin actions
- HTTPS-only in production

## 📊 Performance

- Redis caching for real-time data
- Database connection pooling
- Optimized geo-queries with PostGIS
- WebSocket compression
- Efficient indexing strategy

## 🐛 Troubleshooting

### Database Connection Issues
```bash
# Check PostgreSQL is running
pg_isready

# Verify connection string in .env
echo $DATABASE_URL
```

### Redis Connection Issues
```bash
# Check Redis is running
redis-cli ping

# Should return: PONG
```

### Port Already in Use
```bash
# Find process using port 5000
lsof -i :5000

# Kill the process
kill -9 <PID>
```

## 📝 Development Workflow

1. Create a new branch for your feature
2. Make changes and test locally
3. Run linting: `npm run lint`
4. Format code: `npm run format`
5. Commit with meaningful messages
6. Create pull request

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

MIT License - see LICENSE file for details

## 👥 Team

Developed as a college project for AI-powered bus tracking system.

## 📞 Support

For issues and questions:
- Create an issue on GitHub
- Email: support@example.com

---

**Status**: 🚧 In Development

**Version**: 1.0.0

**Last Updated**: February 2026
