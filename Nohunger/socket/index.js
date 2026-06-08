const { Server } = require("socket.io");
const Notification = require("../models/Notification");
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
      request.senderEmail === tokenEmail;

    const isHandler =
      request.handler === tokenEmail;

    if (!isOwner && !isHandler) {
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

        const { requestId, lat, lng } = data;
        if (
  !requestId ||
  lat == null ||
  lng == null
) {
  return;
}

        const request = await Notification.findOne({ requestId });

        if (!request || !request.receiverLocation) return;

        if (request.handler !== tokenEmail) {
  
          return;
        }

        const receiverLat = request.receiverLocation.lat;
        const receiverLng = request.receiverLocation.lng;

        const distance = calculateDistance(lat, lng, receiverLat, receiverLng);

        const etaMinutes = Math.max(1, Math.round((distance / 25) * 60));

        io.to(`request_${requestId}`).emit("ngoLiveLocation", {
          ngoLat: lat,
          ngoLng: lng,
          receiverLat,
          receiverLng,
          eta: etaMinutes
        });

      } catch (err) {
        console.error("NGO LOCATION ERROR:", err);
      }
    });

    socket.on("registerLocation", ({ role, location, email }) => {

      if (!role || !location || !email) return;

      const tokenEmail = getEmailFromSocket(socket);

      if (!tokenEmail) {
        socket.emit("socketError", { message: "Unauthorized: login required" });
        return;
      }

      const normalizedEmail = email.toLowerCase().trim();

      if (normalizedEmail !== tokenEmail) {
        socket.emit("socketError", { message: "Email does not match token" });
        return;
      }

      socket.email = normalizedEmail;

      if (activeUsers.has(normalizedEmail)) {
        socket.emit("alreadyLoggedIn");
        return;
      }

      activeUsers.set(normalizedEmail, socket.id);

      const room = `${role.toLowerCase().trim()}_${location.toLowerCase().trim()}`;
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
