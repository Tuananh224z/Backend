const jwt = require("jsonwebtoken");
const User = require("../models/user");

/**
 * Middleware to protect routes and verify JWT tokens.
 */
const protect = async (req, res, next) => {
  try {
    let token;

    // 1. Kiểm tra Token trong Header Authorization
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        status: "fail",
        message: "Bạn chưa đăng nhập. Vui lòng đăng nhập để truy cập.",
      });
    }

    // 2. Xác thực Token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        status: "fail",
        message: "Token không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.",
      });
    }

    // 3. Kiểm tra xem người dùng có còn tồn tại không
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      return res.status(401).json({
        status: "fail",
        message: "Tài khoản liên kết với token này không còn tồn tại.",
      });
    }

    // 4. Kiểm tra xem tài khoản có bị khóa không
    if (!currentUser.isActive) {
      return res.status(403).json({
        status: "fail",
        message: "Tài khoản của bạn đã bị khóa bởi quản trị viên.",
      });
    }

    // Gán thông tin người dùng vào request
    req.user = currentUser;
    next();
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

/**
 * Middleware to restrict route access to specific roles.
 * @param {...string} roles - List of allowed roles.
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    // req.user được gán từ middleware 'protect'
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: "fail",
        message: "Bạn không có quyền thực hiện hành động này.",
      });
    }
    next();
  };
};

module.exports = { protect, restrictTo };
