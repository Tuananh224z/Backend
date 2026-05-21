const mongoose = require("mongoose");

const systemSettingsSchema = new mongoose.Schema(
  {
    logo: {
      type: String,
      default: "",
    },
    banners: {
      type: [String],
      default: [],
    },
    contactInfo: {
      address: { type: String, default: "" },
      phone: { type: String, default: "" },
      email: { type: String, default: "" },
      socialLinks: {
        facebook: { type: String, default: "" },
        instagram: { type: String, default: "" },
        youtube: { type: String, default: "" },
      },
    },
    chatbotConfig: {
      systemPrompt: {
        type: String,
        default:
          "Bạn là trợ lý tư vấn bán laptop thông minh, thân thiện. Hãy dựa vào danh sách sản phẩm được cung cấp để tư vấn chi tiết cho khách hàng.",
      },
      temperature: {
        type: Number,
        default: 0.7,
        min: 0,
        max: 2,
      },
      maxTokens: {
        type: Number,
        default: 500,
      },
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("SystemSettings", systemSettingsSchema);
