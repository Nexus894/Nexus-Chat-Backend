/**
 * Pulse Room Model — UNIQUE FEATURE
 * 
 * Temporary chat rooms that auto-expire.
 * Users can create public rooms with a topic, TTL, and capacity.
 * All messages are wiped when the room expires.
 */

const mongoose = require("mongoose");

const pulseRoomSchema = new mongoose.Schema(
  {
    // ── Identity ───────────────────────────────────────────
    name: {
      type: String,
      required: [true, "Room name is required"],
      trim: true,
      maxlength: [50, "Room name too long"],
    },
    topic: {
      type: String,
      maxlength: [200, "Topic too long"],
    },
    emoji: {
      type: String,
      default: "⚡",
    },

    // ── Creator ────────────────────────────────────────────
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // ── TTL — Room Self-Destructs ──────────────────────────
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // MongoDB TTL index — auto-deletes the document
    },
    ttlMinutes: {
      type: Number,
      enum: [60, 180, 360, 720, 1440], // 1h, 3h, 6h, 12h, 24h
      default: 360,
    },

    // ── Access ─────────────────────────────────────────────
    isPublic: {
      type: Boolean,
      default: true,
    },
    inviteCode: {
      type: String,
      unique: true,
      sparse: true, // Only unique when set (private rooms)
    },
    maxParticipants: {
      type: Number,
      default: 50,
      max: [200, "Max 200 participants"],
    },
    participants: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        joinedAt: { type: Date, default: Date.now },
        // Anonymous persona for this room session
        anonymousName: { type: String, default: "" },
      },
    ],

    // ── Stats ──────────────────────────────────────────────
    messageCount: {
      type: Number,
      default: 0,
    },
    peakParticipants: {
      type: Number,
      default: 0,
    },

    // ── Vibe / Category ────────────────────────────────────
    category: {
      type: String,
      enum: ["general", "gaming", "study", "music", "tech", "creative", "random"],
      default: "general",
    },
    vibe: {
      type: String,
      enum: ["chill", "hype", "serious", "fun", "focused"],
      default: "chill",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("PulseRoom", pulseRoomSchema);
