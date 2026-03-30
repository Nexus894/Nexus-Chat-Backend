/**
 * User Controller
 * Profile management, user search, vibe status, theme
 */

const User = require("../models/User");

// ── GET /api/users/search?q= ──────────────────────────────
exports.searchUsers = async (req, res, next) => {
  try {
    const query = req.query.q;
    if (!query || query.length < 2) {
      return res.status(400).json({ error: "Search query too short." });
    }

    const users = await User.find({
      _id: { $ne: req.user._id }, // Exclude self
      $or: [
        { username: { $regex: query, $options: "i" } },
        { displayName: { $regex: query, $options: "i" } },
      ],
    })
      .select("username displayName avatar vibeStatus")
      .limit(20)
      .lean();

    res.json({ success: true, users });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/users/:userId ────────────────────────────────
exports.getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId).select(
      "username displayName avatar bio vibeStatus theme createdAt"
    );

    if (!user) return res.status(404).json({ error: "User not found." });

    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

// ── PATCH /api/users/profile ──────────────────────────────
exports.updateProfile = async (req, res, next) => {
  try {
    const { displayName, bio, avatar } = req.body;
    const allowedUpdates = {};

    if (displayName !== undefined) allowedUpdates.displayName = displayName;
    if (bio !== undefined) allowedUpdates.bio = bio;
    if (avatar !== undefined) allowedUpdates.avatar = avatar;

    const user = await User.findByIdAndUpdate(req.user._id, allowedUpdates, {
      new: true,
      runValidators: true,
    });

    res.json({ success: true, user: user.toPublicProfile() });
  } catch (error) {
    next(error);
  }
};

// ── PATCH /api/users/vibe ─────────────────────────────────
// Update vibe status (mood, emoji, label, auraColor)
exports.updateVibeStatus = async (req, res, next) => {
  try {
    const { mood, emoji, label, auraColor } = req.body;
    const update = {};

    if (mood) update["vibeStatus.mood"] = mood;
    if (emoji) update["vibeStatus.emoji"] = emoji;
    if (label !== undefined) update["vibeStatus.label"] = label;
    if (auraColor) update["vibeStatus.auraColor"] = auraColor;

    const user = await User.findByIdAndUpdate(req.user._id, update, { new: true });

    // Broadcast status to all relevant sockets
    req.io.emit("vibe_update", {
      userId: req.user._id,
      vibeStatus: user.vibeStatus,
    });

    res.json({ success: true, vibeStatus: user.vibeStatus });
  } catch (error) {
    next(error);
  }
};

// ── PATCH /api/users/theme ────────────────────────────────
// Save user's preferred theme
exports.updateTheme = async (req, res, next) => {
  try {
    const { preset, customAccent, darkMode } = req.body;
    const update = {};

    if (preset) update["theme.preset"] = preset;
    if (customAccent) update["theme.customAccent"] = customAccent;
    if (darkMode !== undefined) update["theme.darkMode"] = darkMode;

    const user = await User.findByIdAndUpdate(req.user._id, update, { new: true });

    res.json({ success: true, theme: user.theme });
  } catch (error) {
    next(error);
  }
};

// ── PATCH /api/users/anonymous ────────────────────────────
// Toggle anonymous mode
exports.toggleAnonymous = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    user.isAnonymous = !user.isAnonymous;
    await user.save({ validateBeforeSave: false });

    res.json({
      success: true,
      isAnonymous: user.isAnonymous,
      anonymousPersona: user.anonymousPersona,
    });
  } catch (error) {
    next(error);
  }
};

// ── PATCH /api/users/settings ─────────────────────────────
exports.updateSettings = async (req, res, next) => {
  try {
    const { notifications, readReceipts, soundEnabled, aiSuggestions } = req.body;
    const update = {};

    if (notifications !== undefined) update["settings.notifications"] = notifications;
    if (readReceipts !== undefined) update["settings.readReceipts"] = readReceipts;
    if (soundEnabled !== undefined) update["settings.soundEnabled"] = soundEnabled;
    if (aiSuggestions !== undefined) update["settings.aiSuggestions"] = aiSuggestions;

    const user = await User.findByIdAndUpdate(req.user._id, update, { new: true });

    res.json({ success: true, settings: user.settings });
  } catch (error) {
    next(error);
  }
};
