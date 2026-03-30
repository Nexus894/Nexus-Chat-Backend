const express = require("express");
const { protect } = require("../middleware/auth");
const {
  getMyChats,
  createOrGetDM,
  createGroup,
  getChatById,
} = require("../controllers/chatController");

const router = express.Router();
router.use(protect);

router.get("/", getMyChats);
router.get("/:chatId", getChatById);
router.post("/dm", createOrGetDM);
router.post("/group", createGroup);

module.exports = router;
