const express = require("express");
const router = express.Router();
const { runExtraction, getExtractionRuns, resolveConflict } = require("../controllers/extractionController");

router.post("/:id/extract", runExtraction);
router.get("/:id/extraction-runs", getExtractionRuns);
router.post("/:id/resolve-conflict", resolveConflict);

module.exports = router;
