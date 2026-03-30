/**
 * Chat Model
 * Covers: Direct Messages (DM) and Group Chats
 */

const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
  {
    // ── Type ───────────────────────────────────────────────
    type: {
      type: String,
      enum: ["dm", "group"],
      required: true,
    },

    // ── Group Info (only used when type = "group") ─────────
    name: {
      type: String,
      trim: true,
      maxlength: [50, "Group name too long"],
    },
    description: {
      type: String,
      maxlength: [200, "Description too long"],
    },
    groupAvatar: {
      type: String,
      default: "",
    },

    // ── Members ────────────────────────────────────────────
    members: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        role: {
          type: String,
          enum: ["member", "admin", "owner"],
          default: "member",
        },
        joinedAt: { type: Date, default: Date.now },
        // Unique: per-member nickname in this chat
        nickname: { type: String, default: "" },
        isMuted: { type: Boolean, default: false },
        muteUntil: { type: Date },
      },
    ],

    // ── Latest Message (cached for sidebar preview) ────────
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    lastActivity: {
      type: Date,
      default: Date.now,
    },

    // ── Unique: Pinned Messages ────────────────────────────
    pinnedMessages: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message",
      },
    ],

    // ── Unique: Shared Theme for Group ────────────────────
    groupTheme: {
      accentColor: { type: String, default: "#6366f1" },
      backgroundStyle: {
        type: String,
        enum: ["solid", "gradient", "pattern"],
        default: "solid",
      },
    },

    // ── Settings ───────────────────────────────────────────
    settings: {
      onlyAdminsCanMessage: { type: Boolean, default: false },
      allowAnonymousMode: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
  }
);

// ── Index for finding chats by member ────────────────────
chatSchema.index({ "members.user": 1, lastActivity: -1 });

module.exports = mongoose.model("Chat", chatSchema);
