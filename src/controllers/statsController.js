const statsService = require("../services/statsService");

const getStatsSummary = async (req, res) => {
  try {
    const stats = await statsService.getStatsSummary();
    res.status(200).json({
      status: "success",
      data: stats,
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};

const getChatbotStats = async (req, res) => {
  try {
    const stats = await statsService.getChatbotStats();
    res.status(200).json({
      status: "success",
      data: stats,
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};

const getUserStats = async (req, res) => {
  try {
    const stats = await statsService.getUserStats();
    res.status(200).json({
      status: "success",
      data: stats,
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};

module.exports = {
  getStatsSummary,
  getChatbotStats,
  getUserStats,
};
