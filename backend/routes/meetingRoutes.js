const express = require("express");
const router = express.Router();
const { createMeeting, getAllMeetings, getMeetingById, updateMeeting, deleteMeeting } = require("../controllers/meetingController");

router.post("/", createMeeting);
router.get("/", getAllMeetings);
router.get("/:id", getMeetingById);
router.put("/:id", updateMeeting);
router.delete("/:id", deleteMeeting);

module.exports = router;