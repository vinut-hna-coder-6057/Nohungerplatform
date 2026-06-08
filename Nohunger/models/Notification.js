const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  requestId: {
    type: String,
    index: true
  },

  receiverLocation: {
    lat: Number,
    lng: Number
  },

  image: {
    type: String,
    default: null
  },

  role: {
    type: String,
    required: true
  },

  fromRole: {
    type: String,
    required: true
  },

  senderEmail: String,

  location: {
    type: String,
    index: true
  },

  message: String,
  donorName: String,
  foodItem: String,
  quantity: String,
  foodType: String,

  status: {
    type: String,
    default: "created"
  },

  requestState: {
    type: String,
    enum: [
      "receiver_deciding",
      "donor_deciding",
      "choose_delivery",
      "waiting_for_choice",
      "self_collect_started",
      "ready_to_receive",
      "waiting_for_ngo",
      "delivery_started",
      "picked_up",
      "on_the_way",
      "reached",
      "completed"
    ],
    default: "receiver_deciding"
  },

  handler: String,

  escalationLevel: {
    type: Number,
    default: 0
  },

  details: {
    q1: String,
    q2: String
  },

  feedback: {
    message: String,
    rating: Number
  },

  history: [
    {
      status: String,
      at: {
        type: Date,
        default: Date.now
      }
    }
  ]
}, {
  timestamps: true
});

module.exports = mongoose.model("Notification", notificationSchema);