const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Đánh giá phải thuộc về một người dùng"],
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Đánh giá phải thuộc về một sản phẩm"],
    },
    rating: {
      type: Number,
      required: [true, "Vui lòng chọn số sao từ 1 đến 5"],
      min: [1, "Số sao thấp nhất là 1"],
      max: [5, "Số sao cao nhất là 5"],
    },
    comment: {
      type: String,
      required: [true, "Bình luận không được bỏ trống"],
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true, // Cho phép Admin ẩn bình luận vi phạm
    },
    adminReply: {
      type: String,
      trim: true,
    },
    adminRepliedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Một user chỉ đánh giá một sản phẩm một lần duy nhất
reviewSchema.index({ user: 1, product: 1 }, { unique: true });

// Static method để tự động tính toán ratingsAverage và ratingsQuantity của Product
reviewSchema.statics.calcAverageRatings = async function (productId) {
  const stats = await this.aggregate([
    {
      $match: { product: productId, isActive: true },
    },
    {
      $group: {
        _id: "$product",
        nRating: { $sum: 1 },
        avgRating: { $avg: "$rating" },
      },
    },
  ]);

  const Product = mongoose.model("Product");

  if (stats.length > 0) {
    await Product.findByIdAndUpdate(productId, {
      ratingsQuantity: stats[0].nRating,
      ratingsAverage: stats[0].avgRating,
    });
  } else {
    await Product.findByIdAndUpdate(productId, {
      ratingsQuantity: 0,
      ratingsAverage: 0,
    });
  }
};

// Gọi sau khi lưu đánh giá mới
reviewSchema.post("save", function () {
  this.constructor.calcAverageRatings(this.product);
});

// Trước khi thực hiện update/delete đánh giá, lưu thông tin review hiện tại để lấy ID sản phẩm
// Lưu ý: Mongoose 7+ không truyền callback `next` cho async middleware,
// async function tự động chờ resolve nên không cần gọi next().
reviewSchema.pre(/^findOneAnd/, async function () {
  this.r = await this.model.findOne(this.getQuery());
});

// Gọi sau khi update/delete đánh giá hoàn tất
reviewSchema.post(/^findOneAnd/, async function () {
  if (this.r) {
    await this.r.constructor.calcAverageRatings(this.r.product);
  }
});

module.exports = mongoose.model("Review", reviewSchema);
