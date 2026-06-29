const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  sender: {
    type: String,
    enum: ["user", "bot"],
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
  suggestedProducts: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },
  ],
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const chatbotSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // null nếu là khách chưa đăng nhập (guest)
    },
    sessionToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    messages: [messageSchema],
    feedback: {
      type: String,
      enum: ["like", "dislike", null],
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("ChatbotSession", chatbotSessionSchema);
