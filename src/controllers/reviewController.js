const reviewService = require("../services/reviewService");

const getProductReviews = async (req, res) => {
  try {
    const reviews = await reviewService.getProductReviews(req.params.productId);
    res.status(200).json({
      status: "success",
      results: reviews.length,
      data: reviews,
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};

const createReview = async (req, res) => {
  try {
    const review = await reviewService.createProductReview(req.user._id, req.body);
    res.status(201).json({
      status: "success",
      data: review,
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};

const deleteReview = async (req, res) => {
  try {
    const result = await reviewService.deleteProductReview(req.params.id, req.user._id);
    res.status(200).json({
      status: "success",
      message: result.message,
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};

// --- ADMIN CONTROLLERS ---

const getReviewsAdmin = async (req, res) => {
  try {
    const reviews = await reviewService.adminGetReviews(req.query);
    res.status(200).json({
      status: "success",
      results: reviews.length,
      data: reviews,
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};

const updateReviewStatus = async (req, res) => {
  try {
    const { isActive } = req.body;
    if (isActive === undefined) {
      return res.status(400).json({
        status: "fail",
        message: "Vui lòng cung cấp trạng thái hiển thị (isActive)",
      });
    }
    const review = await reviewService.adminUpdateReviewStatus(req.params.id, isActive);
    res.status(200).json({
      status: "success",
      message: "Cập nhật trạng thái đánh giá thành công",
      data: review,
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};

module.exports = {
  getProductReviews,
  createReview,
  deleteReview,
  getReviewsAdmin,
  updateReviewStatus,
};
