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

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        status: "fail",
        message: "Vui lòng cung cấp địa chỉ email",
      });
    }
    const result = await authService.forgotPassword(email);
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

const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({
        status: "fail",
        message: "Vui lòng cung cấp đầy đủ token và mật khẩu mới",
      });
    }
    const result = await authService.resetPassword(token, newPassword);
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

const googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({
        status: "fail",
        message: "Vui lòng cung cấp Google ID Token",
      });
    }
    const result = await authService.loginWithGoogle(idToken);
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

module.exports = {
  register,
  login,
  googleLogin,
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
};
