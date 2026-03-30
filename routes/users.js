const express = require("express");
const { protect } = require("../middleware/auth");
const {
  searchUsers,
  getUserProfile,
  updateProfile,
  updateVibeStatus,
  updateTheme,
  toggleAnonymous,
  updateSettings,
} = require("../controllers/userController");

const router = express.Router();
router.use(protect);

router.get("/search", searchUsers);
router.get("/:userId", getUserProfile);
router.patch("/profile", updateProfile);
router.patch("/vibe", updateVibeStatus);
router.patch("/theme", updateTheme);
router.patch("/anonymous", toggleAnonymous);
router.patch("/settings", updateSettings);

module.exports = router;


// ============================================================
// backend/routes/chats.js
// ============================================================
const chatExpress = require("express");
const { protect: chatProtect } = require("../middleware/auth");
const {
  getMyChats,
  createOrGetDM,
  createGroup,
  getChatById,
} = require("../controllers/chatController");

const chatRouter = chatExpress.Router();
chatRouter.use(chatProtect);

chatRouter.get("/", getMyChats);
chatRouter.get("/:chatId", getChatById);
chatRouter.post("/dm", createOrGetDM);
chatRouter.post("/group", createGroup);

module.exports = chatRouter;


// ============================================================
// backend/routes/messages.js
// ============================================================
const msgExpress = require("express");
const { protect: msgProtect } = require("../middleware/auth");
const {
  getMessages,
  sendMessage,
  reactToMessage,
  deleteMessage,
} = require("../controllers/messageController");

const msgRouter = msgExpress.Router();
msgRouter.use(msgProtect);

msgRouter.get("/:chatId", getMessages);
msgRouter.post("/:chatId", sendMessage);
msgRouter.post("/react/:messageId", reactToMessage);
msgRouter.delete("/:messageId", deleteMessage);

module.exports = msgRouter;


// ============================================================
// backend/routes/rooms.js
// ============================================================
const roomExpress = require("express");
const { protect: roomProtect } = require("../middleware/auth");
const {
  getPublicRooms,
  createRoom,
  joinRoom,
  leaveRoom,
} = require("../controllers/roomController");

const roomRouter = roomExpress.Router();
roomRouter.use(roomProtect);

roomRouter.get("/", getPublicRooms);
roomRouter.post("/", createRoom);
roomRouter.post("/:roomId/join", joinRoom);
roomRouter.post("/:roomId/leave", leaveRoom);

module.exports = roomRouter;


// ============================================================
// backend/routes/ai.js
// ============================================================
const aiExpress = require("express");
const { protect: aiProtect } = require("../middleware/auth");
const { getSmartReplies } = require("../controllers/aiController");

const aiRouter = aiExpress.Router();
aiRouter.use(aiProtect);

aiRouter.post("/smart-replies", getSmartReplies);

module.exports = aiRouter;
