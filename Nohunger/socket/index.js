const { Server } = require("socket.io");
const Notification = require("../models/Notification");
const User = require("../models/User");
const activeUsers = require("../utils/activeUsers");
const calculateDistance = require("../utils/distance");
const { verifyToken } = require("../utils/jwt");

function getEmailFromSocket(socket) {
  const token = socket.handshake.auth?.token;
  if (!token) return null;

  try {
    const decoded = verifyToken(token);
    if (decoded.isAdmin) return null;
    return decoded.email;
  } catch {
    return null;
  }
}

function initSocket(server, allowedOrigin = "http://localhost:4000") {
  const io = new Server(server, {
    cors: {
      origin: allowedOrigin,
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", socket => {
   
    socket.on("joinRequestRoom", async (requestId) => {
  try {
    if (!requestId) return;

    const tokenEmail = getEmailFromSocket(socket);

    if (!tokenEmail) {
      socket.emit("socketError", {
        message: "Unauthorized"
      });
      return;
    }

    const request = await Notification.findOne({ requestId });

    if (!request) {
      socket.emit("socketError", {
        message: "Request not found"
      });
      return;
    }

    const isOwner =
      request.senderEmail === tokenEmail || request.donorEmail === tokenEmail;

    const isReceiver =
      request.receiverEmail === tokenEmail;

    const isHandler =
      request.handler === tokenEmail;

    if (!isOwner && !isReceiver && !isHandler) {
      socket.emit("socketError", {
        message: "Access denied"
      });
      return;
    }

    socket.join(`request_${requestId}`);


  } catch (err) {
    console.error("joinRequestRoom error:", err);
  }
});

    socket.on("ngoLocationUpdate", async (data) => {
      try {
        const tokenEmail = getEmailFromSocket(socket);
        if (!tokenEmail) return;

        const { requestId, lat, lng } = data || {};
        const latitude = Number(lat);
        const longitude = Number(lng);
        if (!requestId || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
            !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return;

        const request = await Notification.findOne({ requestId });

        if (!request || !request.receiverLocation) return;

        if (request.handler !== tokenEmail) {
          return;
        }

        const handler = await User.findOne({ email: tokenEmail }).select("role");
        if (handler?.role?.toLowerCase() !== "ngo") return;

        const receiverLat = request.receiverLocation.lat;
        const receiverLng = request.receiverLocation.lng;

        const distance = calculateDistance(latitude, longitude, receiverLat, receiverLng);

        const etaMinutes = Math.max(1, Math.round((distance / 25) * 60));

        io.to(`request_${requestId}`).emit("ngoLiveLocation", {
          ngoLat: latitude,
          ngoLng: longitude,
          receiverLat,
          receiverLng,
          eta: etaMinutes
        });

      } catch (err) {
        console.error("NGO LOCATION ERROR:", err);
      }
    });

    socket.on("registerLocation", async ({ email } = {}) => {
      const tokenEmail = getEmailFromSocket(socket);

      if (!tokenEmail) {
        socket.emit("socketError", { message: "Unauthorized: login required" });
        return;
      }

      if (typeof email !== "string" || email.toLowerCase().trim() !== tokenEmail) {
        socket.emit("socketError", { message: "Email does not match token" });
        return;
      }

      const normalizedEmail = tokenEmail;
      let user;
      try {
        user = await User.findOne({ email: normalizedEmail }).select("role location");
      } catch (err) {
        console.error("registerLocation lookup error:", err.message);
        socket.emit("socketError", { message: "Unable to register location" });
        return;
      }
      if (!user?.role || !user?.location) {
        socket.emit("socketError", { message: "User role and location are required" });
        return;
      }

      const activeSocketId = activeUsers.get(normalizedEmail);
      if (activeSocketId && activeSocketId !== socket.id) {
        socket.emit("alreadyLoggedIn");
        return;
      }

      if (socket.locationRoom) socket.leave(socket.locationRoom);
      socket.email = normalizedEmail;
      activeUsers.set(normalizedEmail, socket.id);

      const room = `${user.role.toLowerCase().trim()}_${user.location.toLowerCase().trim()}`;
      socket.locationRoom = room;
      socket.join(room);
    });

    socket.on("disconnect", () => {

      if (socket.email) {
        activeUsers.delete(socket.email);
      }
     // console.log("❌ Socket disconnected");
    });
  });

  return io;
}

module.exports = initSocket;
