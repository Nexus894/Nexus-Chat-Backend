/**
 * Auth Controller
 * Handles: signup, login, logout, get current user
 */

const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const User = require("../models/User");
const { generateAnonymousPersona } = require("../utils/anonymousPersona");

// ── Helper: Generate JWT ─────────────────────────────────
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  });
};

// ── Helper: Set cookie + return token ────────────────────
const sendTokenResponse = (user, statusCode, res) => {
  const token = generateToken(user._id);

  // Set httpOnly cookie (prevents XSS access to token)
  const cookieOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  };

  res
    .status(statusCode)
    .cookie("nexus_token", token, cookieOptions)
    .json({
      success: true,
      token,
      user: user.toPublicProfile(),
    });
};

// ── POST /api/auth/signup ─────────────────────────────────
exports.signup = async (req, res, next) => {
  try {
    // Validate request body
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { username, email, password, displayName } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(409).json({
        error:
          existingUser.email === email
            ? "Email already registered."
            : "Username already taken.",
      });
    }

    // Generate a unique anonymous persona for this user
    const persona = generateAnonymousPersona();

    // Create user
    const user = await User.create({
      username,
      email,
      password,
      displayName: displayName || username,
      anonymousPersona: persona,
    });

    sendTokenResponse(user, 201, res);
  } catch (error) {
    next(error);
  }
};

// ── POST /api/auth/login ──────────────────────────────────
exports.login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { email, password } = req.body;

    // Fetch user WITH password (select: false by default)
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // Compare password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // Update online status
    user.vibeStatus.isOnline = true;
    user.vibeStatus.lastSeen = new Date();
    await user.save({ validateBeforeSave: false });

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// ── POST /api/auth/logout ─────────────────────────────────
exports.logout = async (req, res, next) => {
  try {
    // Mark user offline
    await User.findByIdAndUpdate(req.user._id, {
      "vibeStatus.isOnline": false,
      "vibeStatus.lastSeen": new Date(),
    });

    // Clear cookie
    res
      .cookie("nexus_token", "", {
        expires: new Date(0),
        httpOnly: true,
      })
      .json({ success: true, message: "Logged out successfully." });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/auth/me ──────────────────────────────────────
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ success: true, user: user.toPublicProfile() });
  } catch (error) {
    next(error);
  }
};
