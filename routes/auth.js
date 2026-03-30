// backend/routes/auth.js
const express = require("express");
const { body } = require("express-validator");
const { signup, login, logout, getMe } = require("../controllers/authController");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.post(
  "/signup",
  [
    body("username").trim().isLength({ min: 3, max: 20 }).withMessage("Username must be 3-20 characters"),
    body("email").isEmail().withMessage("Valid email required"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  ],
  signup
);

router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Valid email required"),
    body("password").notEmpty().withMessage("Password required"),
  ],
  login
);

router.post("/logout", protect, logout);
router.get("/me", protect, getMe);

module.exports = router;
