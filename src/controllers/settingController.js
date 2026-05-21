const settingService = require("../services/settingService");

const getSettings = async (req, res) => {
  try {
    const settings = await settingService.getSystemSettings();
    res.status(200).json({
      status: "success",
      data: settings,
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};

const updateSettings = async (req, res) => {
  try {
    const settings = await settingService.updateSystemSettings(req.body, req.user._id);
    res.status(200).json({
      status: "success",
      message: "Cập nhật cấu hình hệ thống thành công",
      data: settings,
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};

module.exports = {
  getSettings,
  updateSettings,
};
