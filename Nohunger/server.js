require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("http");
const path = require("path");
const mongoose = require("mongoose");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const connectDB = require("./config/db");
const { PORT } = require("./config/constants");
const initSocket = require("./socket");
const apiRoutes = require("./routes/apiRoutes");
const {
  startDonationExpiryWorker,
  stopDonationExpiryWorker
} = require("./workers/donationExpiryWorker");

const app = express();const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: {
        success: false,
        message: "Too many login attempts. Try again later."
    }
});

const registerLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
        success: false,
        message: "Too many registration attempts. Try again later."
    }
});
const server = http.createServer(app);

const allowedOrigin = process.env.ALLOWED_ORIGIN || "http://localhost:4000";

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);
app.use(cors({
  origin: allowedOrigin,
  credentials: true
}));
app.use(express.json({
  limit: "1mb"
}));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.static(path.join(__dirname, "public")));

const io = initSocket(server, allowedOrigin);
app.set("io", io);

app.use((req, res, next) => {
  req.io = io;
  next();
});
app.get("/health", (req, res) => {
    res.status(200).json({
        status: "UP"
    });
});
app.use("/api/login", loginLimiter);
app.use("/api/register", registerLimiter);
app.use("/api", apiRoutes);
app.use((err, req, res, next) => {
    console.error(err);

    res.status(500).json({
        success: false,
        message: "Internal Server Error"
    });
});
function shutdown(signal) {
  stopDonationExpiryWorker();
 
  server.close(() => {
    mongoose.disconnect().finally(() => {
     
      process.exit(0);
    });
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

(async () => {
  await connectDB();
  startDonationExpiryWorker();
  server.listen(PORT, () =>
    console.log(`🚀 Server running at http://localhost:${PORT}`)
  );
})();
