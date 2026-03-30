const express = require("express");
const { protect } = require("../middleware/auth");
const {
  getPublicRooms,
  createRoom,
  joinRoom,
  leaveRoom,
} = require("../controllers/roomController");

const router = express.Router();
router.use(protect);

router.get("/", getPublicRooms);
router.post("/", createRoom);
router.post("/:roomId/join", joinRoom);
router.post("/:roomId/leave", leaveRoom);

module.exports = router;
