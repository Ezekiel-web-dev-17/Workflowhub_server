# Workflowhub_server

WorkflowHub Server is a production-ready REST API powering Stackshare, a platform where professionals share, discover, and rate AI-powered workflows and tools. It's built for developers and teams who want a robust backend with JWT auth, role-based access, Cloudinary uploads, Redis caching, and full CRUD for workflows, tools, and reviews. It was created to give the Stackshare frontend a scalable, well-tested foundation so the community can focus on sharing knowledge rather than reinventing infrastructure.

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js + TypeScript (ESM) |
| Framework | Express 5 |
| Database | PostgreSQL via Prisma ORM |
| Cache | Redis (ioredis) |
| Auth | JWT (access + refresh tokens) |
| File Uploads | Cloudinary |
| Security | Helmet, Arcjet (rate limiting, bot detection), CORS |
| Validation | Zod + express-validator |
| Testing | Jest + Supertest |
| Logging | Winston + Morgan |

## Features

- **JWT Authentication** — Access & refresh token flow with secure 
  cookie support and role-based authorization (User / Admin)
- **Security First** — Arcjet-powered rate limiting, bot detection, 
  and shield protection alongside Helmet HTTP headers
- **Workflow Management** — Full CRUD for workflows with nested steps, 
  likes, views, clone tracking, and commenting
- **Tool Catalogue** — Admin-managed tool listings with alternatives, 
  tiered pricing, and a community review/rating system
- **Cloudinary Integration** — Automatic image uploads with rollback 
  on database failure to prevent orphaned files
- **Redis Caching** — Fast data retrieval with TTL-based cache helpers 
  built on ioredis
- **Fully Tested** — Route, middleware, and utility tests via Jest & 
  Supertest with coverage reporting
- **Schema Validation** — Request validation with Zod schemas including 
  conditional publish rules (draft vs. published workflows)
- **Structured Logging** — Winston logger with file and console 
  transports across development and production environments
- **Database Seeding** — Ready-to-run Prisma seed script for 
  bootstrapping admin and test users

## Getting Started

### Prerequisites

Make sure you have the following installed:

- [Node.js](https://nodejs.org/) >= 20.x
- [PostgreSQL](https://www.postgresql.org/) >= 14
- [Redis](https://redis.io/)
- [Git](https://git-scm.com/)

---

### Installation

1. **Clone the repository**
```bash
   git clone https://github.com/your-username/workflowhub-server.git
   cd workflowhub-server
```

2. **Install dependencies**
```bash
   npm install
```

3. **Set up environment variables**
```bash
   cp .env.example .env
```

   Then open `.env` and fill in your values:
```env
   NODE_ENV=development
   PORT=5000

   # PostgreSQL
   DATABASE_URL="postgresql://user:password@localhost:5432/workflowhub"

   # JWT
   JWT_SECRET=your_super_secret_key
   JWT_EXPIRES_IN=7d
   JWT_REFRESH_SECRET=your_refresh_secret_key
   JWT_REFRESH_EXPIRES_IN=30d

   # Cloudinary
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret

   # Arcjet
   ARCJET_KEY=your_arcjet_key

   # Redis
   REDIS_URL=redis://localhost:6379

   # Cookie
   COOKIE_SECRET=your_cookie_secret
   CORS_ORIGIN=http://localhost:3000
```

4. **Run database migrations**
```bash
   npx prisma migrate dev
```

5. **Seed the database**
```bash
   npm run prisma:seed
```

   This creates a default admin and test user:

   | Role  | Email                     | Password   |
   |-------|---------------------------|------------|
   | Admin | admin@workflowhub.com     | Admin123!  |
   | User  | user@workflowhub.com      | User1234!  |

6. **Start the development server**
```bash
   npm run dev
```

   The API will be available at `http://localhost:5000/api/v1`

---

### Running Tests
```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# With coverage report
npm run test:coverage
```

---

### API Health Check

Once running, visit:
```
GET http://localhost:5000/api/v1/health
```

Expected response:
```json
{
  "success": true,
  "message": "WorkflowHub API is running",
  "data": {
    "status": "healthy",
    "timestamp": "2016-03-15T03:59:57+01:00",
    "uptime": 123456789,
    "environment": "development",
  },
  "meta": null,
}
```

## Screenshots

![alt API Health Check](./screenshots/health.png)
![alt Auth Flow](./screenshots/auth/register.png)
![alt Auth Flow](./screenshots/auth/login.png)

## License

Distributed under the MIT License.