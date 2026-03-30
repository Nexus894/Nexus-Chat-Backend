const express = require("express");
const { protect } = require("../middleware/auth");
const {
  getMessages,
  sendMessage,
  reactToMessage,
  deleteMessage,
} = require("../controllers/messageController");

const router = express.Router();
router.use(protect);

router.get("/:chatId", getMessages);
router.post("/:chatId", sendMessage);
router.post("/react/:messageId", reactToMessage);
router.delete("/:messageId", deleteMessage);

module.exports = router;
