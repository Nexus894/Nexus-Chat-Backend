/**
 * NexusChat — Server Entry Point
 * Bootstraps Express + Socket.io + MongoDB
 */

require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const connectDB = require("./config/db");
const { initSocket } = require("./socket/socketHandler");
const errorHandler = require("./middleware/errorHandler");

// ── Routes ──────────────────────────────────────────────
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const chatRoutes = require("./routes/chats");
const messageRoutes = require("./routes/messages");
const roomRoutes = require("./routes/rooms");
const aiRoutes = require("./routes/ai");

// ── App Setup ────────────────────────────────────────────
const app = express();
const httpServer = http.createServer(app);

// ── Socket.io Setup ──────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingTimeout: 60000,
});

// Make io accessible in routes via req.io
app.use((req, _res, next) => {
  req.io = io;
  next();
});

// ── Security Middleware ──────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);

// ── General Middleware ───────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
if (process.env.NODE_ENV === "development") app.use(morgan("dev"));

// ── Rate Limiting (auth routes only) ────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: "Too many requests, please try again later." },
});

// ── API Routes ───────────────────────────────────────────
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/ai", aiRoutes);

// ── Health Check ─────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// ── 404 Handler ──────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ── Global Error Handler ─────────────────────────────────
app.use(errorHandler);

// ── Initialize Socket.io Events ─────────────────────────
initSocket(io);

// ── Start Server ─────────────────────────────────────────
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`\n🚀 NexusChat server running on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
    console.log(`📡 Socket.io ready\n`);
  });
});
