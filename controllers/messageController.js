/**
 * Message Controller
 * Send, fetch, react to, and thread messages
 */

const Message = require("../models/Message");
const Chat = require("../models/Chat");

// ── Helper: verify user is in chat ───────────────────────
const assertMember = (chat, userId) => {
  const isMember = chat.members.some((m) => m.user.toString() === userId.toString());
  if (!isMember) {
    const err = new Error("You are not a member of this chat.");
    err.statusCode = 403;
    throw err;
  }
};

// ── GET /api/messages/:chatId ─────────────────────────────
// Fetch paginated messages for a chat
exports.getMessages = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30;
    const threadId = req.query.threadId || null; // Fetch thread replies

    // Verify membership
    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ error: "Chat not found." });
    assertMember(chat, req.user._id);

    const query = {
      chatId,
      isDeleted: false,
      threadId: threadId ? threadId : null, // root messages only unless threadId given
    };

    const total = await Message.countDocuments(query);
    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("sender", "username displayName avatar vibeStatus isAnonymous anonymousPersona")
      .populate("readBy.user", "username avatar")
      .lean();

    // Return in chronological order
    messages.reverse();

    res.json({
      success: true,
      messages,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

// ── POST /api/messages/:chatId ────────────────────────────
// Send a new message
exports.sendMessage = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const { content, type = "text", mediaUrl, mediaMeta, threadId, aiGenerated } = req.body;

    if (!content && !mediaUrl) {
      return res.status(400).json({ error: "Message content or media is required." });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ error: "Chat not found." });
    assertMember(chat, req.user._id);

    const user = req.user;
    const sentAnon = user.isAnonymous && (chat.settings?.allowAnonymousMode ?? true);

    // Create the message
    const message = await Message.create({
      chatId,
      sender: user._id,
      type,
      content,
      mediaUrl,
      mediaMeta,
      threadId: threadId || null,
      aiGenerated: !!aiGenerated,
      sentAsAnonymous: sentAnon,
      anonymousPersonaSnapshot: sentAnon
        ? { name: user.anonymousPersona.name, color: user.anonymousPersona.color }
        : undefined,
      readBy: [{ user: user._id, readAt: new Date() }],
    });

    // Update parent thread count if this is a reply
    if (threadId) {
      await Message.findByIdAndUpdate(threadId, { $inc: { threadCount: 1 } });
    }

    // Update chat's last message + activity
    chat.lastMessage = message._id;
    chat.lastActivity = new Date();
    await chat.save({ validateBeforeSave: false });

    // Populate sender for the socket emit
    const populated = await message.populate(
      "sender",
      "username displayName avatar vibeStatus isAnonymous anonymousPersona"
    );

    // Emit to all chat members via Socket.io
    req.io.to(chatId).emit("new_message", populated);

    res.status(201).json({ success: true, message: populated });
  } catch (error) {
    next(error);
  }
};

// ── POST /api/messages/:messageId/react ──────────────────
// Add or remove an emoji reaction
exports.reactToMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;

    if (!emoji) return res.status(400).json({ error: "Emoji is required." });

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ error: "Message not found." });

    const userId = req.user._id;
    const existingReaction = message.reactions.find((r) => r.emoji === emoji);

    if (existingReaction) {
      const userIndex = existingReaction.users.findIndex(
        (u) => u.toString() === userId.toString()
      );

      if (userIndex > -1) {
        // Remove user's reaction
        existingReaction.users.splice(userIndex, 1);
        existingReaction.count -= 1;

        // Remove reaction entirely if count hits 0
        if (existingReaction.count === 0) {
          message.reactions = message.reactions.filter((r) => r.emoji !== emoji);
        } else {
          existingReaction.isStorming = existingReaction.count > 5;
        }
      } else {
        // Add user to existing emoji reaction
        existingReaction.users.push(userId);
        existingReaction.count += 1;
        existingReaction.isStorming = existingReaction.count > 5; // Trigger storm!
      }
    } else {
      // New emoji on this message
      message.reactions.push({ emoji, users: [userId], count: 1 });
    }

    await message.save();

    // Broadcast reaction update to chat room
    req.io.to(message.chatId.toString()).emit("reaction_update", {
      messageId,
      reactions: message.reactions,
    });

    res.json({ success: true, reactions: message.reactions });
  } catch (error) {
    next(error);
  }
};

// ── DELETE /api/messages/:messageId ──────────────────────
// Soft delete a message
exports.deleteMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const message = await Message.findById(messageId);

    if (!message) return res.status(404).json({ error: "Message not found." });

    // Only sender can delete
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "You can only delete your own messages." });
    }

    message.isDeleted = true;
    message.deletedAt = new Date();
    message.content = "This message was deleted";
    await message.save();

    req.io.to(message.chatId.toString()).emit("message_deleted", { messageId });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};
