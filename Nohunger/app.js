const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
const mongoose = require("mongoose");

const apiRoutes = require("./routes/apiRoutes");

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://*.tile.openstreetmap.org; media-src 'self' https://www.soundjay.com; connect-src 'self' ws: wss:; frame-src https://www.google.com"
  );
  next();
});

app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || "http://localhost:4000",
  credentials: true
}));

app.use(express.json({
  limit: "1mb"
}));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "UP"
  });
});
app.get("/ready", (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({
    status: ready ? "READY" : "NOT_READY",
    database: ready ? "connected" : "disconnected"
  });
});
app.use("/api", apiRoutes);

module.exports = app;