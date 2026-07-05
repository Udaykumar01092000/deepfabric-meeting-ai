const express = require("express");
const router = express.Router();
const { getUserNotifications, markNotificationRead, triggerReminderCheck } = require("../controllers/notificationController");

router.get("/", getUserNotifications);
router.put("/:id/read", markNotificationRead);
router.post("/check-reminders", triggerReminderCheck);

module.exports = router;
