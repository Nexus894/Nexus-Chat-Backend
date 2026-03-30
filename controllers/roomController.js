/**
 * Pulse Room Controller — UNIQUE FEATURE
 * Temporary chat rooms that auto-expire
 */

const { v4: uuidv4 } = require("uuid");
const PulseRoom = require("../models/PulseRoom");

// ── GET /api/rooms ────────────────────────────────────────
// List all active public rooms
exports.getPublicRooms = async (req, res, next) => {
  try {
    const rooms = await PulseRoom.find({
      isPublic: true,
      expiresAt: { $gt: new Date() }, // Only active rooms
    })
      .sort({ "participants.length": -1, createdAt: -1 })
      .populate("createdBy", "username displayName avatar")
      .lean();

    // Add time remaining to each room
    const withTimeLeft = rooms.map((room) => ({
      ...room,
      participantCount: room.participants.length,
      minutesLeft: Math.round((new Date(room.expiresAt) - Date.now()) / 60000),
    }));

    res.json({ success: true, rooms: withTimeLeft });
  } catch (error) {
    next(error);
  }
};

// ── POST /api/rooms ───────────────────────────────────────
// Create a new Pulse Room
exports.createRoom = async (req, res, next) => {
  try {
    const { name, topic, emoji, ttlMinutes, isPublic, maxParticipants, category, vibe } = req.body;

    if (!name) return res.status(400).json({ error: "Room name is required." });

    const ttl = ttlMinutes || 360;
    const expiresAt = new Date(Date.now() + ttl * 60 * 1000);

    const room = await PulseRoom.create({
      name,
      topic,
      emoji: emoji || "⚡",
      ttlMinutes: ttl,
      expiresAt,
      isPublic: isPublic !== false,
      inviteCode: isPublic === false ? uuidv4().slice(0, 8).toUpperCase() : undefined,
      maxParticipants: maxParticipants || 50,
      category: category || "general",
      vibe: vibe || "chill",
      createdBy: req.user._id,
      participants: [{ user: req.user._id }],
    });

    const populated = await room.populate("createdBy", "username displayName avatar");

    // Broadcast new room to all connected users
    req.io.emit("room_created", {
      ...populated.toObject(),
      participantCount: 1,
      minutesLeft: ttl,
    });

    res.status(201).json({ success: true, room: populated });
  } catch (error) {
    next(error);
  }
};

// ── POST /api/rooms/:roomId/join ──────────────────────────
exports.joinRoom = async (req, res, next) => {
  try {
    const room = await PulseRoom.findById(req.params.roomId);

    if (!room) return res.status(404).json({ error: "Room not found or has expired." });
    if (new Date() > room.expiresAt) {
      return res.status(410).json({ error: "This room has expired." });
    }
    if (room.participants.length >= room.maxParticipants) {
      return res.status(403).json({ error: "Room is full." });
    }

    // Check if already a participant
    const alreadyIn = room.participants.some(
      (p) => p.user.toString() === req.user._id.toString()
    );

    if (!alreadyIn) {
      room.participants.push({ user: req.user._id });
      if (room.participants.length > room.peakParticipants) {
        room.peakParticipants = room.participants.length;
      }
      await room.save();
    }

    // Join the socket room
    req.io.to(`user_${req.user._id}`).socketsJoin(`room_${room._id}`);

    req.io.to(`room_${room._id}`).emit("room_participant_update", {
      roomId: room._id,
      participantCount: room.participants.length,
    });

    res.json({ success: true, room, alreadyJoined: alreadyIn });
  } catch (error) {
    next(error);
  }
};

// ── POST /api/rooms/:roomId/leave ─────────────────────────
exports.leaveRoom = async (req, res, next) => {
  try {
    const room = await PulseRoom.findByIdAndUpdate(
      req.params.roomId,
      { $pull: { participants: { user: req.user._id } } },
      { new: true }
    );

    if (!room) return res.status(404).json({ error: "Room not found." });

    req.io.to(`user_${req.user._id}`).socketsLeave(`room_${room._id}`);
    req.io.to(`room_${room._id}`).emit("room_participant_update", {
      roomId: room._id,
      participantCount: room.participants.length,
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};
