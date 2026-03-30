/**
 * Global Error Handler
 * Catches all errors thrown in routes/controllers
 * Returns consistent JSON error responses
 */

const errorHandler = (err, req, res, _next) => {
  console.error(`❌ Error [${req.method} ${req.path}]:`, err.message);

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ error: messages.join(". ") });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({
      error: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists.`,
    });
  }

  // Mongoose cast error (bad ObjectId)
  if (err.name === "CastError") {
    return res.status(400).json({ error: "Invalid ID format." });
  }

  // Custom app error with status code
  if (err.statusCode) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Default: 500 Internal Server Error
  res.status(500).json({
    error:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Something went wrong. Please try again.",
  });
};

module.exports = errorHandler;
