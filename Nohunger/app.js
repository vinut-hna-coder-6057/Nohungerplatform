const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");

const apiRoutes = require("./routes/apiRoutes");

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

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
app.use("/api", apiRoutes);

module.exports = app;