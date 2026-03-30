/**
 * MongoDB Connection
 * Uses Mongoose ODM with connection pooling and retry logic
 */

const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // Connection pool settings for production
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    process.exit(1);
  }

  // Handle connection events
  mongoose.connection.on("disconnected", () => {
    console.warn("⚠️  MongoDB disconnected. Attempting reconnect...");
  });

  mongoose.connection.on("reconnected", () => {
    console.log("✅ MongoDB reconnected");
  });
};

module.exports = connectDB;
