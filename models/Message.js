/**
 * Message Model
 * 
 * Unique features vs WhatsApp:
 * - reactions: array of {emoji, userId} with particle effect trigger
 * - threadId: enables Slack-style message threads
 * - aiGenerated: flag if message was sent via AI smart reply
 * - type: supports text, voice, image, system messages
 */

const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    // ── Core ───────────────────────────────────────────────
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // ── Content ────────────────────────────────────────────
    type: {
      type: String,
      enum: ["text", "voice", "image", "file", "system"],
      default: "text",
    },
    content: {
      type: String,
      maxlength: [4000, "Message too long"],
    },
    mediaUrl: {
      type: String, // URL for voice/image/file
    },
    mediaMeta: {
      duration: Number,  // Voice message duration in seconds
      size: Number,      // File size in bytes
      mimeType: String,
      filename: String,
    },

    // ── Unique: Emoji Reactions with Storm Effect ─────────
    reactions: [
      {
        emoji: { type: String, required: true },
        users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        count: { type: Number, default: 1 },
        // If count > 5 on same emoji → trigger "reaction storm" animation
        isStorming: { type: Boolean, default: false },
      },
    ],

    // ── Unique: Thread Support ─────────────────────────────
    threadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null, // null = root message, ObjectId = reply in thread
    },
    threadCount: {
      type: Number,
      default: 0, // Count of replies in this message's thread
    },

    // ── Read Status ────────────────────────────────────────
    readBy: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        readAt: { type: Date, default: Date.now },
      },
    ],

    // ── Unique: AI Flag ────────────────────────────────────
    aiGenerated: {
      type: Boolean,
      default: false, // True if sent via AI smart reply
    },

    // ── Anonymous Mode Support ─────────────────────────────
    sentAsAnonymous: {
      type: Boolean,
      default: false,
    },
    anonymousPersonaSnapshot: {
      name: String,
      color: String,
    },

    // ── Edit / Delete ──────────────────────────────────────
    isEdited: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

// ── Indexes for fast querying ─────────────────────────────
messageSchema.index({ chatId: 1, createdAt: -1 });
messageSchema.index({ threadId: 1, createdAt: 1 });

// ── Virtual: reaction summary (emoji → count map) ────────
messageSchema.virtual("reactionSummary").get(function () {
  const summary = {};
  this.reactions.forEach((r) => {
    summary[r.emoji] = r.count;
  });
  return summary;
});

module.exports = mongoose.model("Message", messageSchema);
