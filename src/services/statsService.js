const Order = require("../../models/order");
const User = require("../../models/user");
const Product = require("../../models/product");
const ChatbotSession = require("../../models/chatbotSession");

/**
 * Admin: Get business summary statistics.
 */
const getStatsSummary = async () => {
  // 1. Tổng doanh thu (chỉ tính các đơn hàng đã giao thành công)
  const revenueAggregation = await Order.aggregate([
    { $match: { orderStatus: "Delivered" } },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$totalAmount" },
        count: { $sum: 1 },
      },
    },
  ]);

  const totalRevenue = revenueAggregation.length > 0 ? revenueAggregation[0].totalRevenue : 0;
  const successfulOrdersCount = revenueAggregation.length > 0 ? revenueAggregation[0].count : 0;

  // 2. Tổng số đơn hàng (tất cả các trạng thái)
  const totalOrders = await Order.countDocuments();

  // 3. Tổng số khách hàng
  const totalUsers = await User.countDocuments({ role: "customer" });

  // 4. Top 5 sản phẩm bán chạy nhất
  const bestSellersAgg = await Order.aggregate([
    { $match: { orderStatus: "Delivered" } },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.product",
        totalSold: { $sum: "$items.quantity" },
        revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
      },
    },
    { $sort: { totalSold: -1 } },
    { $limit: 5 },
  ]);

  // Populate thông tin sản phẩm cho best sellers
  const bestSellers = await Promise.all(
    bestSellersAgg.map(async (item) => {
      const product = await Product.findById(item._id).select("name slug price images");
      return {
        product,
        totalSold: item.totalSold,
        revenue: item.revenue,
      };
    })
  );

  return {
    totalRevenue,
    successfulOrdersCount,
    totalOrders,
    totalUsers,
    bestSellers,
  };
};

/**
 * Admin: Get chatbot activity metrics.
 */
const getChatbotStats = async () => {
  // 1. Tổng số phiên chatbot
  const totalSessions = await ChatbotSession.countDocuments();

  // 2. Tỉ lệ phản hồi tích cực/tiêu cực (likes / dislikes)
  const feedbackAgg = await ChatbotSession.aggregate([
    {
      $group: {
        _id: "$feedback",
        count: { $sum: 1 },
      },
    },
  ]);

  const feedbackStats = { like: 0, dislike: 0, none: 0 };
  feedbackAgg.forEach((item) => {
    if (item._id === "like") feedbackStats.like = item.count;
    else if (item._id === "dislike") feedbackStats.dislike = item.count;
    else feedbackStats.none = item.count;
  });

  // 3. Top 10 sản phẩm được AI gợi ý nhiều nhất
  const topAIRecommendationsAgg = await ChatbotSession.aggregate([
    { $unwind: "$messages" },
    { $unwind: "$messages.suggestedProducts" },
    {
      $group: {
        _id: "$messages.suggestedProducts",
        recommendTimes: { $sum: 1 },
      },
    },
    { $sort: { recommendTimes: -1 } },
    { $limit: 10 },
  ]);

  const topAIRecommendations = await Promise.all(
    topAIRecommendationsAgg.map(async (item) => {
      const product = await Product.findById(item._id).select("name slug price images");
      return {
        product,
        recommendTimes: item.recommendTimes,
      };
    })
  );

  return {
    totalSessions,
    feedbackStats,
    topAIRecommendations,
  };
};

/**
 * Admin: Get user signup statistics grouped by month.
 */
const getUserStats = async () => {
  // Thống kê lượng đăng ký mới hàng tháng trong năm nay
  const currentYear = new Date().getFullYear();

  const userGrowth = await User.aggregate([
    {
      $match: {
        role: "customer",
        createdAt: {
          $gte: new Date(`${currentYear}-01-01`),
          $lte: new Date(`${currentYear}-12-31`),
        },
      },
    },
    {
      $group: {
        _id: { $month: "$createdAt" },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Khởi tạo mảng 12 tháng
  const monthlyStats = Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    count: 0,
  }));

  // Gán giá trị thực tế
  userGrowth.forEach((item) => {
    monthlyStats[item._id - 1].count = item.count;
  });

  return monthlyStats;
};

module.exports = {
  getStatsSummary,
  getChatbotStats,
  getUserStats,
};
