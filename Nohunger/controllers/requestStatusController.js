const mongoose = require("mongoose");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { STATUS_ROLE_MAP } = require("../utils/statusAuth");

const normalize = value => String(value || "").toLowerCase().trim();

function appendHistory(status) {
  return { status, at: new Date() };
}

async function updateRelatedNotifications(requestId, anchorId, fields, status, session) {
  await Notification.updateMany(
    { requestId, _id: { $ne: anchorId } },
    {
      $set: fields,
      $push: { history: appendHistory(status) }
    },
    { session }
  );
}

async function transitionRequest({ requestId, status, actor, events, session }) {
  const email = normalize(actor.email);
  const location = normalize(actor.location);
  const common = { requestId, location };
  const set = fields => ({
    $set: fields,
    $push: { history: appendHistory(status) }
  });

  if (status === "receiver_accepted" || status === "receiver_declined") {
    const accepted = status === "receiver_accepted";
    const request = await Notification.findOneAndUpdate(
      {
        ...common,
        role: "receiver",
        fromRole: "donor",
        senderEmail: { $ne: email },
        status: "created",
        requestState: "receiver_deciding",
        receiverEmail: null
      },
      set({
        status: accepted ? "accepted" : "declined",
        requestState: accepted ? "choose_delivery" : "receiver_deciding",
        receiverEmail: email
      }),
      { new: true, session }
    );

    if (!request) return { error: "Request not found or no longer available", statusCode: 404 };
    events.push({ room: `donor_${location}`, event: "requestUpdated", data: { requestId, status } });
    return { success: true };
  }

  if (status === "self_collect" || status === "ask_ngo") {
    const nextState = status === "self_collect" ? "self_collect_started" : "waiting_for_ngo";
    const request = await Notification.findOneAndUpdate(
      {
        ...common,
        role: "receiver",
        fromRole: "donor",
        status: "accepted",
        requestState: "choose_delivery",
        receiverEmail: email
      },
      set({ requestState: nextState }),
      { new: true, session }
    );

    if (!request) return { error: "Request not found or invalid transition", statusCode: 404 };

    const donorEmail = normalize(request.donorEmail || request.senderEmail);
    const recipient = {
      requestId,
      role: status === "self_collect" ? "donor" : "ngo",
      fromRole: "receiver",
      senderEmail: email,
      donorEmail,
      receiverEmail: email,
      location,
      donorName: request.donorName,
      foodItem: request.foodItem,
      quantity: request.quantity,
      foodType: request.foodType,
      message: status === "self_collect"
        ? "Receiver is coming to collect food"
        : "Pickup request from receiver",
      status: status === "self_collect" ? "accepted" : "created",
      requestState: nextState,
      history: [appendHistory(status)]
    };

    await updateRelatedNotifications(requestId, request._id, { requestState: nextState }, status, session);
    await Notification.create([recipient], { session });
    events.push({ room: `${recipient.role}_${location}`, event: "newNotification", data: recipient });
    return { success: true };
  }

  if (status === "reached") {
    const donorNotice = await Notification.findOne({
      ...common,
      role: "donor",
      fromRole: "receiver",
      donorEmail: email,
      requestState: "self_collect_started"
    }).session(session);

    if (!donorNotice) return { error: "Request not found or invalid transition", statusCode: 404 };

    const request = await Notification.findOneAndUpdate(
      {
        ...common,
        role: "receiver",
        fromRole: "donor",
        receiverEmail: donorNotice.receiverEmail,
        status: "accepted",
        requestState: "self_collect_started"
      },
      set({ requestState: "ready_to_receive" }),
      { new: true, session }
    );

    if (!request) return { error: "Request not found or invalid transition", statusCode: 404 };
    const noticeUpdate = await Notification.updateOne(
      { _id: donorNotice._id, requestState: "self_collect_started" },
      set({ requestState: "ready_to_receive" }),
      { session }
    );
    if (noticeUpdate.matchedCount !== 1) throw new Error("Request changed while processing");
    await updateRelatedNotifications(requestId, request._id, { requestState: "ready_to_receive" }, status, session);
    events.push({ room: `receiver_${location}`, event: "requestUpdated", data: { requestId, status: "ready_to_receive" } });
    return { success: true };
  }

  if (status === "received") {
    const request = await Notification.findOneAndUpdate(
      {
        ...common,
        role: "receiver",
        fromRole: "donor",
        status: "accepted",
        requestState: "ready_to_receive",
        receiverEmail: email
      },
      set({ status: "completed", requestState: "completed" }),
      { new: true, session }
    );

    if (!request) return { error: "Request not found or invalid transition", statusCode: 404 };

    const donorEmail = normalize(request.donorEmail || request.senderEmail);
    const donorResult = await User.updateOne(
      { email: donorEmail },
      { $inc: { donationsCount: 1 } },
      { session }
    );
    const receiverResult = await User.updateOne(
      { email },
      { $inc: { receivedCount: 1 } },
      { session }
    );
    if (donorResult.matchedCount !== 1 || receiverResult.matchedCount !== 1) {
      throw new Error("A request participant no longer exists");
    }

    await updateRelatedNotifications(requestId, request._id, { status: "completed", requestState: "completed" }, status, session);
    const completionNotice = {
      requestId,
      role: "donor",
      fromRole: "receiver",
      senderEmail: email,
      donorEmail,
      receiverEmail: email,
      location,
      donorName: request.donorName,
      foodItem: request.foodItem,
      quantity: request.quantity,
      foodType: request.foodType,
      message: "Receiver confirmed food received",
      status: "completed",
      requestState: "completed",
      history: [appendHistory("receiver_confirmed_received")]
    };
    await Notification.create([completionNotice], { session });
    events.push({ room: `donor_${location}`, event: "newNotification", data: completionNotice });
    events.push({ event: "profileUpdated" });
    return { success: true };
  }

  if (status === "ngo_accepted") {
    const request = await Notification.findOneAndUpdate(
      {
        ...common,
        role: "ngo",
        fromRole: "receiver",
        status: "created",
        requestState: "waiting_for_ngo",
        handler: null
      },
      set({ status: "accepted", requestState: "delivery_started", handler: email }),
      { new: true, session }
    );
    if (!request) return { error: "Request not found or no longer available", statusCode: 404 };
    await updateRelatedNotifications(requestId, request._id, {
      status: "accepted",
      requestState: "delivery_started",
      handler: email
    }, status, session);
    events.push({ room: `receiver_${location}`, event: "requestUpdated", data: { requestId, status: "delivery_started" } });
    return { success: true };
  }

  const transitions = {
    picked_up: { from: "delivery_started", to: "picked_up" },
    on_the_way: { from: "picked_up", to: "on_the_way" },
    ngo_delivered: { from: "on_the_way", to: "completed" }
  };
  const transition = transitions[status];
  if (!transition) return { error: "Unsupported status", statusCode: 400 };

  const request = await Notification.findOneAndUpdate(
    {
      ...common,
      role: "ngo",
      handler: email,
      requestState: transition.from
    },
    set({
      requestState: transition.to,
      ...(status === "ngo_delivered" ? { status: "completed" } : {})
    }),
    { new: true, session }
  );
  if (!request) return { error: "Request not found or invalid transition", statusCode: 404 };

  await updateRelatedNotifications(requestId, request._id, {
    requestState: transition.to,
    ...(status === "ngo_delivered" ? { status: "completed" } : {})
  }, status, session);

  if (status === "ngo_delivered") {
    const donorEmail = normalize(request.donorEmail);
    const receiverEmail = normalize(request.receiverEmail);
    const donorResult = await User.updateOne({ email: donorEmail }, { $inc: { donationsCount: 1 } }, { session });
    const receiverResult = await User.updateOne({ email: receiverEmail }, { $inc: { receivedCount: 1 } }, { session });
    const ngoResult = await User.updateOne({ email }, { $inc: { ngoServices: 1 } }, { session });
    if ([donorResult, receiverResult, ngoResult].some(result => result.matchedCount !== 1)) {
      throw new Error("A request participant no longer exists");
    }

    const completionNotice = {
      requestId,
      role: "donor",
      fromRole: "ngo",
      senderEmail: email,
      donorEmail,
      receiverEmail,
      location,
      donorName: request.donorName,
      foodItem: request.foodItem,
      quantity: request.quantity,
      foodType: request.foodType,
      message: "Food successfully delivered to receiver",
      status: "completed",
      requestState: "completed",
      handler: email,
      history: [appendHistory(status)]
    };
    await Notification.create([completionNotice], { session });
    events.push({ room: `donor_${location}`, event: "newNotification", data: completionNotice });
    events.push({ event: "profileUpdated" });
  }

  if (status !== "ngo_delivered") {
    events.push({ room: `receiver_${location}`, event: "requestUpdated", data: { requestId, status: transition.to } });
  }
  return { success: true };
}

exports.updateStatus = async (req, res) => {
  const { requestId, status } = req.body || {};
  if (typeof requestId !== "string" || !requestId.trim() || typeof status !== "string") {
    return res.status(400).json({ success: false, message: "requestId and status are required" });
  }
  const requiredRole = STATUS_ROLE_MAP[status];
  if (!requiredRole) {
    return res.status(400).json({ success: false, message: "Unsupported status" });
  }

  try {
    const actor = await User.findOne({ email: normalize(req.user.email) }).select("email role location");
    if (!actor) return res.status(401).json({ success: false, message: "Account unavailable" });
    if (normalize(actor.role) !== requiredRole || !actor.location) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const session = await mongoose.startSession();
    let result;
    const events = [];
    const io = req.app.get("io");
    try {
      await session.withTransaction(async () => {
        events.length = 0;
        result = await transitionRequest({
          requestId: requestId.trim(),
          status,
          actor,
          events,
          session
        });
      });
    } finally {
      await session.endSession();
    }

    if (result?.error) {
      return res.status(result.statusCode || 404).json({ success: false, message: result.error });
    }
    if (io) {
      for (const event of events) {
        if (event.room) io.to(event.room).emit(event.event, event.data);
        else io.emit(event.event, event.data);
      }
    }
    return res.json({ success: true });
  } catch (err) {
    console.error("UPDATE STATUS ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Unable to update request" });
  }
};

exports.saveReceiverLocation = async (req, res) => {
  try {
    const { requestId, lat, lng } = req.body || {};
    if (typeof requestId !== "string" || !requestId.trim()) {
      return res.status(400).json({ success: false, message: "Invalid request ID" });
    }

    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
        !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      return res.status(400).json({ success: false, message: "Invalid location data" });
    }

    const email = normalize(req.user.email);
    const user = await User.findOne({ email }).select("role location");
    if (!user) return res.status(401).json({ success: false, message: "Account unavailable" });
    if (normalize(user.role) !== "receiver") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const location = normalize(user.location);
    if (!location) return res.status(403).json({ success: false, message: "Role and location required" });

    const request = await Notification.findOne({
      requestId: requestId.trim(),
      role: "ngo",
      location,
      receiverEmail: email,
      requestState: { $in: ["waiting_for_ngo", "delivery_started", "picked_up", "on_the_way"] }
    });
    if (!request) return res.status(404).json({ success: false, message: "Request not found" });

    await Notification.updateMany(
      { requestId: requestId.trim(), receiverEmail: email },
      { $set: { receiverLocation: { lat: latitude, lng: longitude } } }
    );
    return res.json({ success: true });
  } catch (err) {
    console.error("saveReceiverLocation error:", err.message);
    return res.status(500).json({ success: false, message: "Unable to save location" });
  }
};
