require("dotenv").config();

const http = require("http");
const mongoose = require("mongoose");

const connectDB = require("./config/db");
const { PORT } = require("./config/constants");
const initSocket = require("./socket");

const {
  startDonationExpiryWorker,
  stopDonationExpiryWorker
} = require("./workers/donationExpiryWorker");

const app = require("./app");

const server = http.createServer(app);

const io = initSocket(
  server,
  process.env.ALLOWED_ORIGIN || "http://localhost:4000"
);

app.set("io", io);

app.use((req, res, next) => {
  req.io = io;
  next();
});

/* ================= GLOBAL ERROR HANDLER ================= */

app.use((err, req, res, next) => {
  console.error(err);

  res.status(500).json({
    success: false,
    message: "Internal Server Error"
  });
});

/* ================= SHUTDOWN ================= */

function shutdown(signal) {
  console.log(`${signal} received. Shutting down...`);

  stopDonationExpiryWorker();

  server.close(() => {
    mongoose.disconnect().finally(() => {
      console.log("MongoDB disconnected");
      process.exit(0);
    });
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

/* ================= START SERVER ================= */

(async () => {
  try {
    await connectDB();

    startDonationExpiryWorker();

    server.listen(PORT, () => {
      console.log(
        `🚀 Server running at http://localhost:${PORT}`
      );
    });

  } catch (err) {
    console.error("Startup error:", err);
    process.exit(1);
  }
})();