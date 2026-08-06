# 🍲 No Hunger Platform

A real-time food donation and distribution platform that connects **donors**, **receivers**, and **NGOs** to reduce food wastage and fight hunger — with live request tracking, location-based matching, and an admin console to oversee the whole system.

## 🚀 Overview

No Hunger is a MERN-style web app (Express + MongoDB on the backend, vanilla HTML/CSS/JS on the frontend) built around a simple idea: surplus food shouldn't go to waste when someone nearby needs it.

- **Donors** post available food with details, a photo, and an expiry time
- **Receivers** browse donations in their area and raise requests
- **NGOs** can step in to handle pickup/delivery and track it live on a map
- **Admins** monitor users, donations, and platform activity from a dashboard

Donations automatically expire once their expiry time passes, and every request moves through a tracked state machine (from creation to completion) with real-time updates over WebSockets.

## ✨ Key Features

### 🔐 Authentication & Access Control
- JWT-based authentication for users and a separate admin login
- Role-based routes (donor / receiver / NGO / admin)
- Email-based notifications via Nodemailer
- Route protection ensuring users can only access their own profile/activity data

### 🍛 Donations
- Create donations with food details, image upload, and expiry time
- Location-indexed donation listing (`/donations/:location`)
- Automatic background worker that marks donations `expired` once their time passes
- Leaderboard of top contributors

### 🔔 Real-Time Requests & Notifications
- Request/notification lifecycle tracked through defined states — `receiver_deciding → donor_deciding → choose_delivery → self_collect_started / waiting_for_ngo → delivery_started → picked_up → on_the_way → reached → completed`
- Full history log per request
- Socket.io-powered live updates, private per-request "rooms" with access control
- Live NGO location tracking with ETA calculation during delivery
- Feedback and rating on completed requests

### 👨‍💼 Admin Dashboard
- Platform-wide stats
- User management (list/delete users)
- View and moderate all donations

## 🏗️ Architecture

```
Frontend (HTML / CSS / vanilla JS)
        ⬇ REST APIs (Express)         ⬇ WebSockets (Socket.io)
                    Backend (Node.js / Express)
                                ⬇
                        MongoDB (Mongoose)
```

**Supporting services**
- JWT authentication middleware
- Multer for image uploads
- Nodemailer for email notifications
- Background worker for donation expiry
- Helmet + CORS for baseline security hardening

## 🛠️ Tech Stack

**Backend**
- Node.js / Express
- MongoDB & Mongoose
- Socket.io (real-time messaging & live tracking)
- JWT (`jsonwebtoken`) authentication
- bcrypt (password hashing)
- Multer (file uploads)
- Nodemailer (email/OTP notifications)
- Helmet, CORS

**Frontend**
- HTML5, CSS3
- Vanilla JavaScript (modular: auth, donations, notifications, map, admin, profile, socket)

**Testing & Tooling**
- Jest (`tests/`)
- Nodemon
- npm / Node scripts for build/patch utilities

## 📂 Project Structure

```
Nohunger/
├── app.js                      Express app setup (middleware, static files, routes)
├── server.js                    HTTP server bootstrap, Socket.io init, graceful shutdown
├── mail.js                      Mail utility entry point
├── config/
│   ├── db.js                    MongoDB connection
│   ├── multer.js                 Upload configuration
│   └── constants.js              App-wide constants (PORT, etc.)
├── controllers/
│   ├── authController.js         Register/login/logout, admin login
│   ├── userController.js         Profile, role registration, activity, leaderboard
│   ├── donationController.js     Create/list donations
│   ├── notificationController.js Request lifecycle, status updates, receiver location
│   └── adminController.js        Stats, user & donation management
├── middleware/
│   └── auth.js                   authMiddleware, adminMiddleware, requireSelfEmail
├── models/
│   ├── User.js
│   ├── Donation.js
│   └── Notification.js
├── routes/
│   └── apiRoutes.js              All /api routes
├── socket/
│   └── index.js                  Socket.io connection handling, rooms, live location
├── workers/
│   └── donationExpiryWorker.js   Periodic job to expire stale donations
├── utils/
│   ├── jwt.js, mail.js, distance.js, statusAuth.js, activeUsers.js
├── public/                      Frontend (index.html, css/, js/, images/)
├── tests/                       Jest test suites
└── scripts/                     Build/patch utility scripts for the frontend
```

## 🔑 API Overview

**Public**
- `POST /api/register` — register a new user
- `POST /api/login` — user login
- `POST /api/admin/login` — admin login
- `GET /api/leaderboard` — top donors/receivers

**Authenticated (user)**
- `POST /api/logout`
- `POST /api/registerRole` — assign donor/receiver/NGO role
- `GET /api/profile/:email`
- `GET /api/my-activity/:email`
- `POST /api/donate` — create a donation (with image upload)
- `GET /api/donations/:location`
- `POST /api/notify` — raise a request/notification
- `GET /api/notifications/:role/:location`
- `POST /api/update-status`
- `POST /api/save-receiver-location`

**Authenticated (admin)**
- `GET /api/admin/stats`
- `GET /api/admin/users`
- `DELETE /api/admin/delete-user/:id`
- `GET /api/admin/donations`

**Health check:** `GET /health`

## ⚙️ Environment Variables

Copy `.env.example` to `.env` and fill in your own values:

```env
# Server
PORT=4000

# Database
MONGO_URI=mongodb://localhost:27017/nohunger

# JWT
JWT_SECRET=your_jwt_secret_here

# Admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD_HASH=your_bcrypt_hash_here

# Frontend
ALLOWED_ORIGIN=http://localhost:4000

# Email
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

Use `scripts/hash-admin-password.js` to generate a bcrypt hash for `ADMIN_PASSWORD_HASH`.

## 🚀 Getting Started

### Prerequisites
- Node.js
- MongoDB (local or Atlas)

### Setup

```bash
git clone <repo-url>
cd Nohunger
npm install
cp .env.example .env   # then fill in your values
npm run dev             # starts with nodemon
```

App runs on:
```
http://localhost:4000
```

### Available Scripts

```bash
npm start     # start the server
npm run dev   # start with nodemon (auto-restart)
npm test      # run Jest test suite
```

## 🧪 Testing

Tests live in `tests/` and cover auth, login, profile, health/status, notifications, admin, and route protection. Run them with:

```bash
npm test
```

## 🔮 Future Enhancements

- Push notifications / SMS alerts
- NGO verification workflow
- Donation impact analytics dashboard
- Mobile app
- Multi-language support

## 📄 License

ISC — see `package.json`. Update as needed for your project.

---

⭐ If you found this project useful, consider giving it a star on GitHub!
