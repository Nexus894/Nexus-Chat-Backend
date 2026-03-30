/**
 * User Model
 * 
 * Unique fields vs WhatsApp:
 * - vibeStatus: rich status with mood + emoji + color aura
 * - theme: per-user color theme preference
 * - anonymousPersona: auto-generated identity for anonymous mode
 * - isAnonymous: toggle for anonymous chat mode
 */

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    // ── Core Identity ──────────────────────────────────────
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
      minlength: [3, "Username must be at least 3 characters"],
      maxlength: [20, "Username cannot exceed 20 characters"],
      match: [/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, underscore"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false, // Never return password in queries by default
    },

    // ── Profile ────────────────────────────────────────────
    displayName: {
      type: String,
      trim: true,
      maxlength: [30, "Display name cannot exceed 30 characters"],
    },
    avatar: {
      type: String,
      default: "", // URL to avatar image
    },
    bio: {
      type: String,
      maxlength: [150, "Bio cannot exceed 150 characters"],
      default: "",
    },

    // ── Unique: Vibe Status (richer than online/offline) ──
    vibeStatus: {
      mood: {
        type: String,
        enum: ["focused", "chilling", "busy", "creative", "gaming", "studying", "away", "dnd"],
        default: "chilling",
      },
      emoji: { type: String, default: "😊" },
      label: { type: String, default: "Just chilling", maxlength: 60 },
      auraColor: { type: String, default: "#6366f1" }, // CSS color for the glow effect
      isOnline: { type: Boolean, default: false },
      lastSeen: { type: Date, default: Date.now },
    },

    // ── Unique: Per-User Theme ─────────────────────────────
    theme: {
      preset: {
        type: String,
        enum: ["nebula", "forest", "ocean", "sunset", "midnight", "neon", "rose"],
        default: "nebula",
      },
      customAccent: { type: String, default: "#6366f1" },
      darkMode: { type: Boolean, default: true },
    },

    // ── Unique: Anonymous Mode ─────────────────────────────
    anonymousPersona: {
      name: { type: String, default: "" },   // e.g. "CrimsonFox42"
      avatar: { type: String, default: "" }, // Generated avatar URL
      color: { type: String, default: "" },
    },
    isAnonymous: {
      type: Boolean,
      default: false,
    },

    // ── Relationships ──────────────────────────────────────
    contacts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // ── Settings ───────────────────────────────────────────
    settings: {
      notifications: { type: Boolean, default: true },
      readReceipts: { type: Boolean, default: true },
      soundEnabled: { type: Boolean, default: true },
      aiSuggestions: { type: Boolean, default: true }, // Toggle AI smart replies
    },
  },
  {
    timestamps: true,
  }
);

// ── Pre-save Hook: Hash Password ─────────────────────────
userSchema.pre("save", async function (next) {
  // Only hash if password field was modified
  if (!this.isModified("password")) return next();

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ── Instance Method: Compare Passwords ───────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ── Instance Method: Public Profile (safe to send to client) ──
userSchema.methods.toPublicProfile = function () {
  return {
    _id: this._id,
    username: this.username,
    displayName: this.displayName || this.username,
    avatar: this.avatar,
    bio: this.bio,
    vibeStatus: this.vibeStatus,
    theme: this.theme,
    isAnonymous: this.isAnonymous,
    anonymousPersona: this.anonymousPersona,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model("User", userSchema);
