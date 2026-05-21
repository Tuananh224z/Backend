/**
 * Middleware để xác thực người dùng hiện tại có phải là Admin không.
 * Yêu cầu chạy sau middleware 'protect' để đảm bảo req.user đã tồn tại.
 */
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    return res.status(403).json({
      status: "fail",
      message: "Quyền truy cập bị từ chối. Chỉ dành cho quản trị viên (Admin).",
    });
  }
};

module.exports = isAdmin;
