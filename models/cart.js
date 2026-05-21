const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: [true, "Sản phẩm là bắt buộc"],
  },
  quantity: {
    type: Number,
    required: [true, "Số lượng là bắt buộc"],
    min: [1, "Số lượng sản phẩm tối thiểu là 1"],
    default: 1,
  },
  price: {
    type: Number,
    required: [true, "Giá sản phẩm tại thời điểm thêm vào giỏ là bắt buộc"],
  },
});

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Người dùng sở hữu giỏ hàng là bắt buộc"],
      unique: true, // Mỗi người dùng chỉ có duy nhất 1 giỏ hàng
    },
    items: [cartItemSchema],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Cart", cartSchema);
