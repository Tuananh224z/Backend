const rateLimit = require("express-rate-limit");

/**
 * Middleware giới hạn tần suất đăng nhập (Rate Limiter).
 * Tối đa 5 lần thử đăng nhập từ cùng một IP trong vòng 15 phút.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 5, // Tối đa 5 lần yêu cầu đăng nhập từ một địa chỉ IP
  message: {
    status: "fail",
    message: "Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau 15 phút."
  },
  standardHeaders: true, // Trả về thông tin giới hạn trong headers chuẩn `RateLimit-*`
  legacyHeaders: false, // Vô hiệu hóa headers cũ `X-RateLimit-*`
  // Đảm bảo mã trạng thái là 429 (Too Many Requests)
  statusCode: 429
});

module.exports = loginLimiter;
