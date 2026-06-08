const express = require("express");
const authController = require("../controllers/authController");
const userController = require("../controllers/userController");
const notificationController = require("../controllers/notificationController");
const donationController = require("../controllers/donationController");
const adminController = require("../controllers/adminController");
const upload = require("../config/multer");
const {
  authMiddleware,
  adminMiddleware,
  requireSelfEmail
} = require("../middleware/auth");

const router = express.Router();

/* Public auth */
router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/admin/login", authController.adminLogin);
router.get("/leaderboard", userController.getLeaderboard);

/* Protected user routes */
router.post("/logout", authMiddleware, authController.logout);
router.post("/registerRole", authMiddleware, userController.registerRole);
router.get("/profile/:email", authMiddleware, requireSelfEmail, userController.getProfile);
router.get("/my-activity/:email", authMiddleware, requireSelfEmail, userController.getMyActivity);

router.post("/notify", authMiddleware, notificationController.createNotification);
router.get("/notifications/:role/:location", authMiddleware, notificationController.getNotifications);
router.post("/update-status", authMiddleware, notificationController.updateStatus);
router.post("/save-receiver-location", authMiddleware, notificationController.saveReceiverLocation);

router.post("/donate", authMiddleware, (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
}, donationController.createDonation);
router.get("/donations/:location", authMiddleware, donationController.getDonationsByLocation);

/* Protected admin routes */
router.get("/admin/stats", authMiddleware, adminMiddleware, adminController.getStats);
router.get("/admin/users", authMiddleware, adminMiddleware, adminController.getUsers);
router.delete("/admin/delete-user/:id", authMiddleware, adminMiddleware, adminController.deleteUser);
router.get("/admin/donations", authMiddleware, adminMiddleware, adminController.getDonations);

module.exports = router;
