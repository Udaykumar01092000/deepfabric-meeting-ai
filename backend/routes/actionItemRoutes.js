const express = require("express");
const router = express.Router();
const {
    getActionItems, getInbox, getActionItemById,
    createActionItem, updateActionItem, deleteActionItem,
    unlockActionItem, addComment, getComments, mergeActionItems,
} = require("../controllers/actionItemController");

router.get("/", getActionItems);
router.get("/inbox", getInbox);
router.post("/merge", mergeActionItems);
router.get("/:id", getActionItemById);
router.post("/", createActionItem);
router.put("/:id", updateActionItem);
router.delete("/:id", deleteActionItem);
router.put("/:id/unlock", unlockActionItem);
router.post("/:id/comments", addComment);
router.get("/:id/comments", getComments);

module.exports = router;
