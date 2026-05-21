const userService = require("../services/userService");

const getUsersAdmin = async (req, res) => {
  try {
    const users = await userService.getUsersAdmin(req.query);
    res.status(200).json({
      status: "success",
      results: users.length,
      data: users,
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};

const getUserDetailsAdmin = async (req, res) => {
  try {
    const user = await userService.getUserDetailsAdmin(req.params.id);
    res.status(200).json({
      status: "success",
      data: user,
    });
  } catch (error) {
    res.status(404).json({
      status: "fail",
      message: error.message,
    });
  }
};

const toggleUserLockAdmin = async (req, res) => {
  try {
    const user = await userService.toggleUserLockAdmin(req.params.id);
    res.status(200).json({
      status: "success",
      message: user.isActive ? "Mở khóa người dùng thành công" : "Khóa người dùng thành công",
      data: user,
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};

const updateUserRoleAdmin = async (req, res) => {
  try {
    const { role } = req.body;
    if (!role) {
      return res.status(400).json({
        status: "fail",
        message: "Vui lòng cung cấp vai trò mới (role)",
      });
    }
    const user = await userService.updateUserRoleAdmin(req.params.id, role);
    res.status(200).json({
      status: "success",
      message: "Cập nhật vai trò người dùng thành công",
      data: user,
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};

module.exports = {
  getUsersAdmin,
  getUserDetailsAdmin,
  toggleUserLockAdmin,
  updateUserRoleAdmin,
};
