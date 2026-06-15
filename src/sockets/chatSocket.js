const ChatbotSession = require("../models/chatbotSession");
const chatService = require("../services/chatService");

const initChatSocket = (io) => {
  io.on("connection", (socket) => {
    console.log(`Một thiết bị đã kết nối chat: ${socket.id}`);

    // Lắng nghe tin nhắn gửi từ client
    socket.on("sendMessage", async (data) => {
      try {
        const { sessionToken, messageText, userId } = data;

        if (!sessionToken || !messageText) {
          return socket.emit("error", { message: "Thiếu sessionToken hoặc nội dung tin nhắn" });
        }

        // 1. Tìm hoặc tạo phiên hội thoại mới trong Database
        let session = await ChatbotSession.findOne({ sessionToken });
        if (!session) {
          session = await ChatbotSession.create({
            sessionToken,
            user: userId || null,
            messages: [],
          });
        }

        // 2. Thêm tin nhắn của người dùng vào session
        session.messages.push({
          sender: "user",
          text: messageText,
          timestamp: new Date(),
        });
        await session.save();

        // 3. Gọi dịch vụ RAG Chatbot (Tìm kiếm laptop phù hợp và hỏi Groq API)
        const chatReply = await chatService.getChatbotReply(sessionToken, messageText);

        // 4. Thêm tin nhắn trả lời của Bot vào session
        session.messages.push({
          sender: "bot",
          text: chatReply.reply,
          suggestedProducts: chatReply.suggestedProducts,
          timestamp: new Date(),
        });
        await session.save();

        // 5. Populate chi tiết sản phẩm gợi ý để gửi về cho client hiển thị UI đẹp mắt
        const populatedSession = await ChatbotSession.findById(session._id)
          .populate("messages.suggestedProducts", "name price discountPrice images slug specs");

        const lastBotMessage = populatedSession.messages[populatedSession.messages.length - 1];

        // 6. Trả tin nhắn phản hồi về cho client thời gian thực
        socket.emit("receiveMessage", {
          sender: "bot",
          text: lastBotMessage.text,
          suggestedProducts: lastBotMessage.suggestedProducts,
          timestamp: lastBotMessage.timestamp,
        });

      } catch (error) {
        console.error("Lỗi WebSocket Chat:", error.message);
        socket.emit("error", { message: "Không thể xử lý tin nhắn của bạn lúc này." });
      }
    });

    // Lắng nghe đánh giá của khách hàng (Like/Dislike chatbot)
    socket.on("sendFeedback", async (data) => {
      try {
        const { sessionToken, feedback } = data;
        if (!["like", "dislike", null].includes(feedback)) {
          return socket.emit("error", { message: "Feedback không hợp lệ" });
        }

        const session = await ChatbotSession.findOneAndUpdate(
          { sessionToken },
          { $set: { feedback } },
          { returnDocument: 'after' }
        );

        if (session) {
          socket.emit("feedbackUpdated", { status: "success", feedback });
        }
      } catch (error) {
        console.error("Lỗi cập nhật feedback qua Socket:", error.message);
      }
    });

    socket.on("disconnect", () => {
      console.log(`Khách hàng ngắt kết nối chat: ${socket.id}`);
    });
  });
};

module.exports = initChatSocket;
