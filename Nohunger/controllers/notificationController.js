const crypto = require("crypto");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { getRequiredRoleForStatus } = require("../utils/statusAuth");

async function getUserRole(email) {
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  return user?.role?.toLowerCase() || null;
}

exports.createNotification = async (req, res) => {
  try {
    const { location, details, image, foodType } = req.body;
    const email = req.user.email;
    const io = req.app.get("io");

    if (!location) {
      return res.status(400).json({ success: false });
    }

    const senderUser = await User.findOne({ email });

    if (!senderUser || !senderUser.role) {
      return res.status(400).json({ success: false });
    }

    const senderRole = senderUser.role.toLowerCase();
    const loc = location.toLowerCase();

    let allowedTargets = [];

    if (senderRole === "donor") allowedTargets = ["receiver"];
    else if (senderRole === "receiver") allowedTargets = ["donor"];
    else if (senderRole === "ngo") allowedTargets = ["receiver"];

    if (!allowedTargets.length) {
      return res.status(400).json({ success: false });
    }

    const uniquePart = crypto.randomBytes(3).toString("hex").toUpperCase();

    const today = new Date();
    const dateStr =
      today.getFullYear().toString() +
      String(today.getMonth() + 1).padStart(2, "0") +
      String(today.getDate()).padStart(2, "0");

    const cityCode = location.substring(0, 3).toUpperCase();

    const requestId = `NH-${cityCode}-${dateStr}-${uniquePart}`;

    const docs = allowedTargets.map(targetRole => ({
      requestId,
      role: targetRole,
      fromRole: senderRole,
      senderEmail: email,
      location: loc,

      message:
        senderRole === "donor"
          ? `🍱 ${foodType?.toUpperCase() || ""} Food Available`
          : `🍽️ Food Request`,

      donorName: senderUser.name || null,

      foodItem: details?.q1 || "-",
      quantity: details?.q2 || "-",
      foodType: foodType || "Not specified",

      status: "created",
      requestState:
        senderRole === "donor"
          ? "receiver_deciding"
          : "donor_deciding",

      details: details || {},
      image: image || null,
      history: [{ status: "created", at: new Date() }]
    }));

    await Notification.insertMany(docs);

    docs.forEach(n => {
      const room = `${n.role}_${n.location}`
        .replace(/\s+/g, "")
        .toLowerCase()
        .trim();

      io.to(room).emit("newNotification", n);
    });

    res.json({ success: true, requestId });

  } catch (err) {
    console.error("❌ notify error:", err.message);
    res.status(500).json({ success: false });
  }
};

exports.getNotifications = async (req, res) => {
  try {
    const role = req.params.role.toLowerCase();
    const location = req.params.location.toLowerCase();
    const email = req.user.email;

const user = await User.findOne({
  email: email.toLowerCase().trim()
});

if (!user || !user.role || !user.location) {
  return res.json([]);
}

const dbRole = user.role.toLowerCase();
const dbLocation = user.location.toLowerCase();

if (dbRole !== role || dbLocation !== location) {
  return res.status(403).json({
    success: false,
    message: "Forbidden"
  });
}

    const data = await Notification.aggregate([
      {
        $match: {
          role,
          location
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: "$requestId",
          doc: { $first: "$$ROOT" }
        }
      },
      {
        $replaceRoot: { newRoot: "$doc" }
      }
    ]);

    res.json(data);

  } catch (err) {
    console.error("Fetch notifications error:", err.message);
    res.json([]);
  }
};
exports.saveReceiverLocation = async (req, res) => {
  try {
    const { requestId, lat, lng } = req.body;
    const email = req.user.email;

    const parsedLat = Number(lat);
    const parsedLng = Number(lng);

    if (
      !requestId ||
      Number.isNaN(parsedLat) ||
      Number.isNaN(parsedLng)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid location data"
      });
    }

    const notification = await Notification.findOne({
  requestId,
  role: "ngo"
});

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Request not found"
      });
    }

    if (
      notification.senderEmail.toLowerCase().trim() !==
      email.toLowerCase().trim()
    ) {
      return res.status(403).json({
        success: false,
        message: "Forbidden"
      });
    }

    const result = await Notification.updateMany(
      { requestId },
      {
        $set: {
          receiverLocation: {
            lat: parsedLat,
            lng: parsedLng
          }
        }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Request not found"
      });
    }

    res.json({ success: true });

  } catch (err) {
    console.error("saveReceiverLocation error:", err);
    res.status(500).json({ success: false });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { requestId, status } = req.body;
    const email = req.user.email;
    const io = req.app.get("io");

    if (!requestId || !status) {
      return res.status(400).json({
  success: false,
  message: "requestId and status are required"
});
    }

    const actorRole = await getUserRole(email);
    const requiredRole = getRequiredRoleForStatus(status);

    if (requiredRole && actorRole !== requiredRole) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: invalid role for this action"
      });
    }

    const base = await Notification.findOne({ requestId });
    if (!base) {
      return res.status(404).json({
  success: false,
  message: "Not Found"
});
    }

    if (base.senderEmail === email) {
      return res.json({
        success: false,
        message: "Cannot accept your own request"
      });
    }

    const location = base.location.toLowerCase().trim();

    if (status === "receiver_accepted") {

      await Notification.updateMany(
        { requestId, role: "receiver" },
        {
          status: "accepted",
          requestState: "choose_delivery",
          $push: { history: { status: "receiver_accepted" } }
        }
      );

      await Notification.updateMany(
        { requestId, role: "donor" },
        {
          status: "receiver_confirmed",
          requestState: "waiting_for_choice",
          $push: { history: { status: "receiver_confirmed" } }
        }
      );

      return res.json({ success: true });
    }

    if (status === "receiver_declined") {
      await Notification.updateMany(
        { requestId, role: "receiver" },
        { status: "declined" }
      );

      return res.json({ success: true });
    }
    if (status === "self_collect") {
      await Notification.updateMany(
  { requestId },
  {
    requestState: "ready_to_receive",
    $push: {
      history: {
        status: "self_collect",
        at: new Date()
      }
    }
  }
);
  const donorNotification = await Notification.create({
    requestId,
    role: "donor",
    fromRole: "receiver",
    senderEmail: base.senderEmail,
    location: base.location,
    donorName: base.donorName,
    foodItem: base.foodItem,
    quantity: base.quantity,
    foodType: base.foodType,
    message: "🚶 Receiver is coming to collect food",
    status: "accepted",
    requestState: "self_collect_started"
  });

  io.to(`donor_${location}`)
    .emit("newNotification", donorNotification);

  return res.json({ success: true });
}
  if (status === "reached") {

  await Notification.updateMany(
    { requestId },
    {
      requestState: "ready_to_receive",
      $push: {
        history: {
          status: "reached",
          at: new Date()
        }
      }
    }
  );

  return res.json({ success: true });
}
    if (status === "received") {
   if (!base) {
  return res.status(404).json({
    success: false,
    message: "Request not found"
  });
}

if (
  base.status === "completed" ||
  base.requestState === "completed"
){
  return res.status(400).json({
    success: false,
    message: "Request already completed"
  });
}

      io.emit("profileUpdated");
      await Notification.updateMany(
        { requestId },
        {
          status: "completed",
          requestState: "completed",
          $push: { history: { status: "received" } }
        }
      );

      await User.updateOne(
        { email: base.senderEmail },
        { $inc: { donationsCount: 1 } }
      );

      await User.updateOne(
        { email: email.toLowerCase().trim() },
        { $inc: { receivedCount: 1 } }
      );

      const donorNotification = await Notification.create({
        requestId,
        role: "donor",
        fromRole: "receiver",
        senderEmail: base.senderEmail,
        location: base.location,
        donorName: base.donorName,
        foodItem: base.foodItem,
        quantity: base.quantity,
        foodType: base.foodType,
        message: "✅ Receiver confirmed food received",
        status: "completed",
        requestState: "completed",
        history: [{ status: "receiver_confirmed_received" }]
      });

      io.to(`donor_${base.location.toLowerCase().trim()}`)
        .emit("newNotification", donorNotification);

      return res.json({ success: true });
    }

    if (status === "ask_ngo") {

      await Notification.updateMany(
        { requestId },
        {
          requestState: "waiting_for_ngo",
          $push: { history: { status: "waiting_for_ngo" } }
        }
      );

      const receiverUser = await User.findOne({
        email: email.toLowerCase().trim()
      });


      const ngoNotification = await Notification.create({
        requestId,
        role: "ngo",
        fromRole: "receiver",
        senderEmail: email,
        location,
        donorName: receiverUser?.name || "Receiver",
        foodItem: base.foodItem,
        quantity: base.quantity,
        foodType: base.foodType,
        message: "📦 Pickup request from receiver",
        status: "created",
        requestState: "waiting_for_ngo",
        history: [{ status: "waiting_for_ngo" }]
      });

      io.to(`ngo_${location}`).emit("newNotification", ngoNotification);

      return res.json({ success: true });
    }

    if (status === "ngo_accepted") {

      await Notification.updateMany(
        { requestId },
        {
          status: "accepted",
          requestState: "delivery_started",
          handler: email,

          $push: { history: { status: "ngo_accepted" } }
        }
      );

      return res.json({ success: true });
    }

    if (status === "picked_up") {
      await Notification.updateMany(
  { requestId },
  {
    requestState: "picked_up",
    $push: {
      history: {
        status: "picked_up",
        at: new Date()
      }
    }
  }
);
      return res.json({ success: true });
    }

    if (status === "on_the_way") {
      await Notification.updateMany(
  { requestId },
  {
    requestState: "on_the_way",
    $push: {
      history: {
        status: "on_the_way",
        at: new Date()
      }
    }
  }
);
      return res.json({ success: true });
    }
    if (status === "ngo_delivered") {
     if (!base) {
  return res.status(404).json({
    success: false,
    message: "Request not found"
  });
}

if (
  base.status === "completed" ||
  base.requestState === "completed"
) {
  return res.status(400).json({
    success: false,
    message: "Request already completed"
  });
}

      await Notification.updateMany(
        { requestId },
        {
          status: "completed",
          requestState: "completed",
          $push: { history: { status: "ngo_delivered" } }
        }
      );


      const donorUpdate = await User.updateOne(
        { email: base.senderEmail },
        { $inc: { donationsCount: 1 } }
      );


      const ngoUpdate = await User.updateOne(
        { email: email.toLowerCase().trim() },
        { $inc: { ngoServices: 1 } }
      );


      const donorNotification = await Notification.create({
        requestId,
        role: "donor",
        fromRole: "ngo",
        senderEmail: base.senderEmail,
        location: base.location,
        donorName: base.donorName,
        foodItem: base.foodItem,
        quantity: base.quantity,
        foodType: base.foodType,
        message: "✅ Food successfully delivered to receiver",
        status: "completed",
        requestState: "completed",
        history: [{ status: "ngo_delivered" }]
      });

      io.to(`donor_${base.location.toLowerCase().trim()}`)
        .emit("newNotification", donorNotification);

      io.emit("profileUpdated");

      return res.json({ success: true });
    }

    return res.json({ success: true });

  } catch (err) {
    console.error("UPDATE STATUS ERROR:", err);
    return res.status(500).json({
  success: false,
  message: "Server error"
});
  }
};
