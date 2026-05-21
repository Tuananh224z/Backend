const authService = require("../services/authService");

const register = async (req, res) => {
  try {
    const result = await authService.registerUser(req.body);
    res.status(201).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        status: "fail",
        message: "Vui lòng cung cấp email và mật khẩu",
      });
    }
    const result = await authService.loginUser(email, password);
    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};

const getProfile = async (req, res) => {
  try {
    const userProfile = await authService.getUserProfile(req.user._id);
    res.status(200).json({
      status: "success",
      data: userProfile,
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const updatedUser = await authService.updateUserProfile(req.user._id, req.body);
    res.status(200).json({
      status: "success",
      data: updatedUser,
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};

const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        status: "fail",
        message: "Vui lòng cung cấp mật khẩu cũ và mật khẩu mới",
      });
    }
    const result = await authService.changeUserPassword(req.user._id, oldPassword, newPassword);
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

const toggleFavorite = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!productId) {
      return res.status(400).json({
        status: "fail",
        message: "Vui lòng cung cấp productId",
      });
    }
    const result = await authService.toggleFavoriteProduct(req.user._id, productId);
    res.status(200).json({
      status: "success",
      message: result.isAdded ? "Đã thêm vào sản phẩm yêu thích" : "Đã xóa khỏi sản phẩm yêu thích",
      data: result.user,
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  toggleFavorite,
};
