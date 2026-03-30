/**
 * Auth Middleware
 * Verifies JWT from Authorization header or cookie
 * Attaches user to req.user
 */

const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  try {
    let token;

    // 1. Check Authorization header (Bearer token)
    if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }
    // 2. Fallback: check httpOnly cookie
    else if (req.cookies?.nexus_token) {
      token = req.cookies.nexus_token;
    }

    if (!token) {
      return res.status(401).json({ error: "Not authenticated. Please log in." });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch user (exclude password)
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({ error: "User no longer exists." });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid token." });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired. Please log in again." });
    }
    next(error);
  }
};

module.exports = { protect };
