const express = require("express");
const router = express.Router();
const { getAuditLogsByMeeting } = require("../controllers/auditController");

router.get("/", getAuditLogsByMeeting);

module.exports = router;
