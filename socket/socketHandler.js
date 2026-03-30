/**
 * NexusChat — Socket.io Event Handler
 * The real-time core of the entire application.
 *
 * Events handled:
 *   Connection / Disconnection
 *   Chat room join/leave
 *   Typing indicators
 *   Online presence & vibe status
 *   Pulse Room messaging
 *   Read receipts
 *   Message delivery confirmation
 */

const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Message = require("../models/Message");
const Chat = require("../models/Chat");
const PulseRoom = require("../models/PulseRoom");

// ── In-memory maps (fast, no DB hit for presence) ────────
// userId → socketId(s)  (one user can have multiple tabs)
const onlineUsers = new Map(); // userId → Set<socketId>

// roomId → Set<userId>  (for Pulse Rooms)
const roomPresence = new Map();

// ── Auth middleware for Socket.io ─────────────────────────
const socketAuth = async (socket, next) => {
  try {
    // Token from handshake auth OR cookie
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.cookie
        ?.split(";")
        .find((c) => c.trim().startsWith("nexus_token="))
        ?.split("=")[1];

    if (!token) return next(new Error("Authentication required"));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select(
      "username displayName avatar vibeStatus isAnonymous anonymousPersona settings"
    );

    if (!user) return next(new Error("User not found"));

    socket.userId = user._id.toString();
    socket.user = user;
    next();
  } catch (err) {
    next(new Error("Invalid or expired token"));
  }
};

// ── Helper: broadcast online users list ──────────────────
const broadcastOnlineStatus = (io, userId, isOnline) => {
  io.emit("user_status_change", {
    userId,
    isOnline,
    lastSeen: new Date().toISOString(),
  });
};

// ── Helper: add/remove from onlineUsers map ───────────────
const trackConnection = (userId, socketId, connected) => {
  if (connected) {
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socketId);
  } else {
    const sockets = onlineUsers.get(userId);
    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) onlineUsers.delete(userId);
    }
  }
};

// ── Main init function ────────────────────────────────────
const initSocket = (io) => {
  // Apply auth middleware to every socket connection
  io.use(socketAuth);

  io.on("connection", async (socket) => {
    const userId = socket.userId;
    const user = socket.user;

    console.log(`🔌 Connected: ${user.username} (${socket.id})`);

    // ── 1. Track presence ──────────────────────────────────
    trackConnection(userId, socket.id, true);

    // Join a personal room so we can target this user directly
    // e.g. for new DM notifications: io.to(`user_${userId}`)
    socket.join(`user_${userId}`);

    // ── 2. Mark online in DB (debounced — only if first socket) ──
    if (onlineUsers.get(userId)?.size === 1) {
      await User.findByIdAndUpdate(userId, {
        "vibeStatus.isOnline": true,
        "vibeStatus.lastSeen": new Date(),
      });
      broadcastOnlineStatus(io, userId, true);
    }

    // ── 3. Auto-join all of this user's chat rooms ─────────
    try {
      const chats = await Chat.find({ "members.user": userId }, "_id");
      chats.forEach((chat) => socket.join(chat._id.toString()));
    } catch (err) {
      console.error("Error joining chat rooms:", err.message);
    }

    // ── 4. Send current online users to this socket ────────
    const onlineUserIds = [...onlineUsers.keys()];
    socket.emit("online_users", onlineUserIds);

    // ════════════════════════════════════════════════════════
    // CHAT ROOM EVENTS
    // ════════════════════════════════════════════════════════

    // Join a specific chat room (called when user opens a chat)
    socket.on("join_chat", async ({ chatId }) => {
      try {
        const chat = await Chat.findOne({ _id: chatId, "members.user": userId });
        if (!chat) return socket.emit("error", { message: "Chat not found or access denied" });

        socket.join(chatId);
        socket.emit("joined_chat", { chatId });
      } catch (err) {
        socket.emit("error", { message: "Failed to join chat" });
      }
    });

    // Leave a chat room (e.g. user closes the chat window)
    socket.on("leave_chat", ({ chatId }) => {
      socket.leave(chatId);
    });

    // ════════════════════════════════════════════════════════
    // TYPING INDICATORS
    // ════════════════════════════════════════════════════════

    // Stores active typing timers: `${chatId}_${userId}` → timeout
    const typingTimers = {};

    socket.on("typing_start", ({ chatId }) => {
      const key = `${chatId}_${userId}`;

      // Broadcast to everyone in chat EXCEPT the typer
      socket.to(chatId).emit("user_typing", {
        chatId,
        userId,
        username: user.isAnonymous ? user.anonymousPersona.name : user.displayName || user.username,
        isTyping: true,
      });

      // Auto-clear typing after 4s of inactivity (safety net)
      clearTimeout(typingTimers[key]);
      typingTimers[key] = setTimeout(() => {
        socket.to(chatId).emit("user_typing", {
          chatId,
          userId,
          isTyping: false,
        });
        delete typingTimers[key];
      }, 4000);
    });

    socket.on("typing_stop", ({ chatId }) => {
      const key = `${chatId}_${userId}`;
      clearTimeout(typingTimers[key]);
      delete typingTimers[key];

      socket.to(chatId).emit("user_typing", {
        chatId,
        userId,
        isTyping: false,
      });
    });

    // ════════════════════════════════════════════════════════
    // READ RECEIPTS
    // ════════════════════════════════════════════════════════

    socket.on("mark_read", async ({ chatId, messageIds }) => {
      try {
        if (!Array.isArray(messageIds) || messageIds.length === 0) return;

        // Add userId to readBy for all unread messages in bulk
        await Message.updateMany(
          {
            _id: { $in: messageIds },
            chatId,
            "readBy.user": { $ne: userId }, // Not already read by this user
          },
          {
            $push: { readBy: { user: userId, readAt: new Date() } },
          }
        );

        // Notify others in the chat that messages were read
        socket.to(chatId).emit("messages_read", {
          chatId,
          readerId: userId,
          messageIds,
          readAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error("mark_read error:", err.message);
      }
    });

    // ════════════════════════════════════════════════════════
    // MESSAGE DELIVERY CONFIRMATION
    // ════════════════════════════════════════════════════════

    // Client sends this after receiving a message to confirm delivery
    socket.on("message_delivered", async ({ messageId }) => {
      try {
        // Just acknowledge — could store delivery receipts in DB if needed
        const message = await Message.findById(messageId).select("chatId sender");
        if (!message) return;

        // Tell the sender their message was delivered
        io.to(`user_${message.sender.toString()}`).emit("delivery_confirmed", {
          messageId,
          deliveredTo: userId,
          deliveredAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error("delivery confirmation error:", err.message);
      }
    });

    // ════════════════════════════════════════════════════════
    // PULSE ROOMS (temporary chat rooms)
    // ════════════════════════════════════════════════════════

    socket.on("join_pulse_room", async ({ roomId }) => {
      try {
        const room = await PulseRoom.findById(roomId);
        if (!room || new Date() > room.expiresAt) {
          return socket.emit("error", { message: "Room expired or not found" });
        }

        socket.join(`room_${roomId}`);

        // Track presence in room
        if (!roomPresence.has(roomId)) roomPresence.set(roomId, new Set());
        roomPresence.get(roomId).add(userId);

        // Notify room of new joiner
        const displayName = user.isAnonymous
          ? user.anonymousPersona.name
          : user.displayName || user.username;

        socket.to(`room_${roomId}`).emit("room_user_joined", {
          roomId,
          userId,
          displayName,
          participantCount: roomPresence.get(roomId).size,
        });

        socket.emit("joined_pulse_room", {
          roomId,
          participantCount: roomPresence.get(roomId).size,
          minutesLeft: Math.round((new Date(room.expiresAt) - Date.now()) / 60000),
        });
      } catch (err) {
        socket.emit("error", { message: "Failed to join room" });
      }
    });

    socket.on("leave_pulse_room", ({ roomId }) => {
      socket.leave(`room_${roomId}`);
      const presence = roomPresence.get(roomId);
      if (presence) {
        presence.delete(userId);
        if (presence.size === 0) roomPresence.delete(roomId);
      }

      socket.to(`room_${roomId}`).emit("room_user_left", {
        roomId,
        userId,
        participantCount: roomPresence.get(roomId)?.size ?? 0,
      });
    });

    // Send a message to a Pulse Room (not stored in Chat collection)
    socket.on("pulse_room_message", async ({ roomId, content }) => {
      try {
        if (!content?.trim()) return;

        const room = await PulseRoom.findById(roomId);
        if (!room || new Date() > room.expiresAt) {
          return socket.emit("error", { message: "Room has expired" });
        }

        const isInRoom = room.participants.some((p) => p.user.toString() === userId);
        if (!isInRoom) {
          return socket.emit("error", { message: "Not a member of this room" });
        }

        // Increment message count
        await PulseRoom.findByIdAndUpdate(roomId, { $inc: { messageCount: 1 } });

        const displayName = user.isAnonymous
          ? user.anonymousPersona.name
          : user.displayName || user.username;

        const avatar = user.isAnonymous ? user.anonymousPersona.avatar : user.avatar;

        // Broadcast to everyone in the room (including sender for confirmation)
        io.to(`room_${roomId}`).emit("pulse_room_message", {
          id: `${Date.now()}_${userId}`,
          roomId,
          sender: {
            id: user.isAnonymous ? "anon" : userId,
            displayName,
            avatar,
            auraColor: user.vibeStatus?.auraColor || "#6366f1",
          },
          content: content.trim(),
          sentAt: new Date().toISOString(),
          isAnonymous: user.isAnonymous,
        });
      } catch (err) {
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    // ════════════════════════════════════════════════════════
    // VIBE STATUS UPDATE (real-time broadcast)
    // ════════════════════════════════════════════════════════

    socket.on("update_vibe", async ({ mood, emoji, label, auraColor }) => {
      try {
        const update = {};
        if (mood) update["vibeStatus.mood"] = mood;
        if (emoji) update["vibeStatus.emoji"] = emoji;
        if (label !== undefined) update["vibeStatus.label"] = label;
        if (auraColor) update["vibeStatus.auraColor"] = auraColor;

        const updated = await User.findByIdAndUpdate(userId, update, { new: true });

        // Broadcast new vibe to everyone
        io.emit("vibe_update", {
          userId,
          vibeStatus: updated.vibeStatus,
        });
      } catch (err) {
        console.error("vibe update error:", err.message);
      }
    });

    // ════════════════════════════════════════════════════════
    // REACTION STORM TRIGGER
    // ════════════════════════════════════════════════════════

    // Called by client when a reaction crosses the storm threshold
    // to ensure all clients trigger the particle animation
    socket.on("trigger_reaction_storm", ({ chatId, messageId, emoji }) => {
      io.to(chatId).emit("reaction_storm", { messageId, emoji });
    });

    // ════════════════════════════════════════════════════════
    // DISCONNECTION
    // ════════════════════════════════════════════════════════

    socket.on("disconnect", async (reason) => {
      console.log(`🔌 Disconnected: ${user.username} — reason: ${reason}`);

      // Clear any lingering typing timers
      Object.keys(typingTimers).forEach((key) => {
        clearTimeout(typingTimers[key]);
        // Extract chatId from key and notify
        const chatId = key.split("_")[0];
        socket.to(chatId).emit("user_typing", { chatId, userId, isTyping: false });
      });

      trackConnection(userId, socket.id, false);

      // Only mark offline if ALL sockets for this user disconnected
      if (!onlineUsers.has(userId)) {
        await User.findByIdAndUpdate(userId, {
          "vibeStatus.isOnline": false,
          "vibeStatus.lastSeen": new Date(),
        });
        broadcastOnlineStatus(io, userId, false);

        // Remove from all Pulse Rooms
        for (const [roomId, presence] of roomPresence.entries()) {
          if (presence.has(userId)) {
            presence.delete(userId);
            io.to(`room_${roomId}`).emit("room_user_left", {
              roomId,
              userId,
              participantCount: presence.size,
            });
            if (presence.size === 0) roomPresence.delete(roomId);
          }
        }
      }
    });

    // ── Error catch-all ────────────────────────────────────
    socket.on("error", (err) => {
      console.error(`Socket error from ${user.username}:`, err.message);
    });
  });

  // Log total connections every 30s in development
  if (process.env.NODE_ENV === "development") {
    setInterval(() => {
      console.log(`📊 Active connections: ${io.engine.clientsCount} | Online users: ${onlineUsers.size}`);
    }, 30000);
  }
};

// Export both the init function and the presence map
// (presence map can be queried by REST endpoints if needed)
module.exports = { initSocket, onlineUsers };
