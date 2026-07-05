const express = require("express");
const router = express.Router();
const { getDecisions, createDecision, updateDecision, deleteDecision } = require("../controllers/decisionController");
const { spawnFollowUpFromDecision } = require("../controllers/actionItemController");

router.get("/", getDecisions);
router.post("/", createDecision);
router.put("/:id", updateDecision);
router.delete("/:id", deleteDecision);
router.post("/:id/spawn-task", spawnFollowUpFromDecision);

module.exports = router;
