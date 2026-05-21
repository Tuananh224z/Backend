const cors = require("cors");

const corsOptions = {
  origin: process.env.CLIENT_URL || "*", // Cho phép client cụ thể hoặc tất cả
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  optionsSuccessStatus: 200,
};

module.exports = cors(corsOptions);
