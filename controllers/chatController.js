/**
 * Chat Controller
 * Create/fetch DMs and groups
 */

const Chat = require("../models/Chat");
const User = require("../models/User");

// ── GET /api/chats ────────────────────────────────────────
// Get all chats for the current user
exports.getMyChats = async (req, res, next) => {
  try {
    const chats = await Chat.find({ "members.user": req.user._id })
      .sort({ lastActivity: -1 })
      .populate("members.user", "username displayName avatar vibeStatus isAnonymous anonymousPersona")
      .populate({
        path: "lastMessage",
        populate: { path: "sender", select: "username displayName" },
      })
      .lean();

    res.json({ success: true, chats });
  } catch (error) {
    next(error);
  }
};

// ── POST /api/chats/dm ────────────────────────────────────
// Start or fetch an existing DM with another user
exports.createOrGetDM = async (req, res, next) => {
  try {
    const { userId } = req.body;

    if (!userId) return res.status(400).json({ error: "User ID required." });
    if (userId === req.user._id.toString()) {
      return res.status(400).json({ error: "Cannot DM yourself." });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) return res.status(404).json({ error: "User not found." });

    // Check if a DM already exists between these two users
    const existing = await Chat.findOne({
      type: "dm",
      "members.user": { $all: [req.user._id, userId] },
    }).populate("members.user", "username displayName avatar vibeStatus");

    if (existing) {
      return res.json({ success: true, chat: existing, isNew: false });
    }

    // Create new DM
    const chat = await Chat.create({
      type: "dm",
      members: [
        { user: req.user._id, role: "member" },
        { user: userId, role: "member" },
      ],
    });

    const populated = await chat.populate(
      "members.user",
      "username displayName avatar vibeStatus"
    );

    // Notify target user of new DM
    req.io.to(`user_${userId}`).emit("new_chat", populated);

    res.status(201).json({ success: true, chat: populated, isNew: true });
  } catch (error) {
    next(error);
  }
};

// ── POST /api/chats/group ─────────────────────────────────
// Create a new group chat
exports.createGroup = async (req, res, next) => {
  try {
    const { name, description, memberIds } = req.body;

    if (!name) return res.status(400).json({ error: "Group name is required." });
    if (!memberIds || memberIds.length < 1) {
      return res.status(400).json({ error: "Add at least one member." });
    }

    // De-duplicate and validate member IDs
    const uniqueIds = [...new Set([...memberIds, req.user._id.toString()])];
    const users = await User.find({ _id: { $in: uniqueIds } });

    const members = users.map((u) => ({
      user: u._id,
      role: u._id.toString() === req.user._id.toString() ? "owner" : "member",
    }));

    const group = await Chat.create({
      type: "group",
      name,
      description,
      members,
    });

    const populated = await group.populate(
      "members.user",
      "username displayName avatar vibeStatus"
    );

    // Notify all members
    members.forEach((m) => {
      req.io.to(`user_${m.user}`).emit("new_chat", populated);
    });

    res.status(201).json({ success: true, chat: populated });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/chats/:chatId ────────────────────────────────
exports.getChatById = async (req, res, next) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.chatId,
      "members.user": req.user._id,
    }).populate("members.user", "username displayName avatar vibeStatus isAnonymous anonymousPersona");

    if (!chat) return res.status(404).json({ error: "Chat not found." });

    res.json({ success: true, chat });
  } catch (error) {
    next(error);
  }
};
