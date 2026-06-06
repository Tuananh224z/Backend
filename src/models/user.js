const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email là bắt buộc"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: [true, "Mật khẩu là bắt buộc"],
    },
    fullName: {
      type: String,
      required: [true, "Họ và tên là bắt buộc"],
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    avatar: {
      type: String,
      default: "",
    },
    role: {
      type: String,
      enum: ["customer", "admin"],
      default: "customer",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    address: {
      street: { type: String, default: "" },
      ward: { type: String, default: "" },
      district: { type: String, default: "" },
      city: { type: String, default: "" },
    },
    addresses: [
      {
        fullName: { type: String, required: true },
        phone: { type: String, required: true },
        street: { type: String, default: "" },
        ward: { type: String, default: "" },
        district: { type: String, default: "" },
        city: { type: String, default: "" },
        isDefault: { type: Boolean, default: false },
      }
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);
