const chatService = require("../services/chatService");

const getSessionMessages = async (req, res) => {
  try {
    const messages = await chatService.getSessionMessages(req.params.sessionId);
    res.status(200).json({
      status: "success",
      results: messages.length,
      data: messages,
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};

const getChatSessions = async (req, res) => {
  try {
    const sessions = await chatService.getChatSessions();
    res.status(200).json({
      status: "success",
      results: sessions.length,
      data: sessions,
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};

const getPopularQuestions = async (req, res) => {
  try {
    const questions = await chatService.getPopularQuestions();
    res.status(200).json({
      status: "success",
      results: questions.length,
      data: questions,
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};

module.exports = {
  getSessionMessages,
  getChatSessions,
  getPopularQuestions,
};
