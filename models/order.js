const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  name: {
    type: String,
    required: true, // Lưu tên sản phẩm tại thời điểm mua để tránh thay đổi tên sản phẩm gốc ảnh hưởng tới lịch sử
  },
  price: {
    type: Number,
    required: true, // Giá mua thực tế (đã tính chiết khấu lẻ nếu có)
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
});

const orderSchema = new mongoose.Schema(
  {
    orderCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Đơn hàng phải thuộc về một người dùng"],
    },
    items: [orderItemSchema],
    shippingAddress: {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      street: { type: String, required: true },
      ward: { type: String, default: "" },
      district: { type: String, default: "" },
      city: { type: String, required: true },
    },
    paymentMethod: {
      type: String,
      enum: ["COD", "Online"],
      default: "COD",
    },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed"],
      default: "Pending",
    },
    paymentDetails: {
      type: mongoose.Schema.Types.Mixed, // Lưu metadata từ VNPay / Momo / PayOS...
    },
    orderStatus: {
      type: String,
      enum: ["Pending", "Confirmed", "Processing", "Shipping", "Delivered", "Cancelled"],
      default: "Pending",
    },
    shippingFee: {
      type: Number,
      default: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
    },
    couponApplied: {
      type: String,
      default: "",
    },
    totalAmount: {
      type: Number,
      required: true, // Tổng tiền khách hàng thực trả sau khi tính phí ship và giảm giá
    },
    notes: {
      type: String,
      default: "",
    },
    cancelledReason: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Order", orderSchema);
