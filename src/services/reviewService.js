const Review = require("../../models/review");

/**
 * Public: Get reviews of a product.
 */
const getProductReviews = async (productId) => {
  return await Review.find({ product: productId, isActive: true })
    .populate("user", "fullName avatar")
    .sort({ createdAt: -1 });
};

/**
 * Customer: Write a review for a product.
 */
const createProductReview = async (userId, reviewData) => {
  const { product, rating, comment } = reviewData;

  // 1. Kiểm tra xem người dùng đã đánh giá sản phẩm này chưa
  const existingReview = await Review.findOne({ user: userId, product });
  if (existingReview) {
    throw new Error("Bạn đã đánh giá sản phẩm này rồi");
  }

  // 2. Tạo đánh giá mới
  const newReview = await Review.create({
    user: userId,
    product,
    rating,
    comment,
  });

  return await newReview.populate("user", "fullName avatar");
};

/**
 * Customer: Delete their own review.
 */
const deleteProductReview = async (reviewId, userId) => {
  // Đảm bảo chỉ xóa review của chính mình
  const review = await Review.findOne({ _id: reviewId, user: userId });
  if (!review) {
    throw new Error("Không tìm thấy đánh giá hoặc bạn không có quyền xóa");
  }

  await Review.findByIdAndDelete(reviewId);
  return { message: "Đã xóa đánh giá thành công" };
};

/**
 * Admin: View all reviews.
 */
const adminGetReviews = async (query = {}) => {
  return await Review.find(query)
    .populate("user", "fullName email")
    .populate("product", "name slug")
    .sort({ createdAt: -1 });
};

/**
 * Admin: Moderation (Hide/Show review).
 */
const adminUpdateReviewStatus = async (reviewId, isActive) => {
  // Thực hiện findOneAndUpdate để kích hoạt Mongoose Hook /^findOneAnd/ cập nhật ratings trung bình
  const updatedReview = await Review.findOneAndUpdate(
    { _id: reviewId },
    { $set: { isActive } },
    { new: true }
  );

  if (!updatedReview) {
    throw new Error("Không tìm thấy đánh giá cần cập nhật");
  }

  return updatedReview;
};

/**
 * Admin: Reply to a review.
 */
const adminReplyReview = async (reviewId, adminReply) => {
  const updatedReview = await Review.findOneAndUpdate(
    { _id: reviewId },
    { $set: { adminReply, adminRepliedAt: new Date() } },
    { new: true }
  );

  if (!updatedReview) {
    throw new Error("Không tìm thấy đánh giá cần phản hồi");
  }

  return updatedReview;
};

module.exports = {
  getProductReviews,
  createProductReview,
  deleteProductReview,
  adminGetReviews,
  adminUpdateReviewStatus,
  adminReplyReview,
};
