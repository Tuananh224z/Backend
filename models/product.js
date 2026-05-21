const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Tên sản phẩm là bắt buộc"],
      trim: true,
      index: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Danh mục sản phẩm là bắt buộc"],
    },
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      required: [true, "Thương hiệu sản phẩm là bắt buộc"],
    },
    price: {
      type: Number,
      required: [true, "Giá sản phẩm là bắt buộc"],
      min: [0, "Giá không thể nhỏ hơn 0"],
    },
    discountPrice: {
      type: Number,
      default: 0,
      validate: {
        validator: function (value) {
          // discountPrice must be less than price
          return value < this.price;
        },
        message: "Giá khuyến mại phải nhỏ hơn giá bán gốc",
      },
    },
    sku: {
      type: String,
      default: "",
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    shortDesc: {
      type: String,
      default: "",
    },
    images: {
      type: [String],
      default: [],
    },
    stock: {
      type: Number,
      required: [true, "Số lượng tồn kho là bắt buộc"],
      min: [0, "Số lượng tồn kho không thể nhỏ hơn 0"],
      default: 0,
    },
    description: {
      type: String,
      default: "",
    },
    summary: {
      type: String,
      default: "",
    },
    // Thông số cấu hình laptop chi tiết (legacy)
    specs: {
      cpu: { type: String, default: "" },
      ram: { type: String, default: "" },
      storage: { type: String, default: "" },
      vga: { type: String, default: "" },
      screenSize: { type: String, default: "" },
      battery: { type: String, default: "" },
      weight: { type: Number, default: 0 }, // kg
      os: { type: String, default: "Windows 11" },
    },
    // Thông số kỹ thuật phân nhóm động (mockup mới)
    specGroups: [
      {
        name: { type: String, default: "" },
        items: [
          {
            key: { type: String, default: "" },
            value: { type: String, default: "" },
          },
        ],
      },
    ],
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isBestSeller: {
      type: Boolean,
      default: false,
    },
    isNewArrival: {
      type: Boolean,
      default: false,
    },
    isHot: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    ratingsAverage: {
      type: Number,
      default: 0,
      min: [0, "Đánh giá trung bình thấp nhất là 0"],
      max: [5, "Đánh giá trung bình cao nhất là 5"],
      set: (val) => Math.round(val * 10) / 10, // Làm tròn đến 1 chữ số thập phân
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
    },
    // Vector Embedding (phục vụ MongoDB Atlas Vector Search trong RAG)
    embedding: {
      type: [Number],
      default: undefined, // undefined để không tự động lưu mảng rỗng nếu không có dữ liệu
    },
  },
  {
    timestamps: true,
  }
);

// Tạo Text Index cho tính năng tìm kiếm thông thường (Keyword Search)
productSchema.index({
  name: "text",
  description: "text",
  "specs.cpu": "text",
  "specs.ram": "text",
});

module.exports = mongoose.model("Product", productSchema);
