const axios = require("axios");
const Product = require("../../models/product");
const SystemSettings = require("../../models/systemSettings");
const ChatbotSession = require("../../models/chatbotSession");

/**
 * Perform RAG: Retrieve relevant products, build prompt, call LLM.
 */
const getChatbotReply = async (sessionToken, messageText) => {
  try {
    // 1. Tìm kiếm sản phẩm liên quan trong Database (Retrieval)
    let matchedProducts = [];
    
    // Thử dùng Text Index trước để tìm kiếm thông minh
    if (messageText && messageText.trim() !== "") {
      matchedProducts = await Product.find(
        { isActive: true, $text: { $search: messageText } }
      )
      .select("name price discountPrice specs slug description")
      .limit(4);
    }

    // Nếu tìm kiếm text index không ra kết quả, thử tìm theo regex tên hoặc cấu hình hoặc lấy sản phẩm nổi bật làm fallback
    if (matchedProducts.length === 0) {
      const keywords = messageText.toLowerCase();
      // Tìm hãng hoặc từ khóa cụ thể trong tên
      matchedProducts = await Product.find({
        isActive: true,
        $or: [
          { name: { $regex: keywords.split(" ")[0], $options: "i" } },
          { isFeatured: true }
        ]
      })
      .select("name price discountPrice specs slug description")
      .limit(4);
    }

    // 2. Lấy cấu hình hệ thống & System Prompt
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = {
        chatbotConfig: {
          systemPrompt: "Bạn là nhân viên tư vấn laptop chuyên nghiệp. Hãy dùng các thông tin sản phẩm có sẵn ở cửa hàng để hỗ trợ khách hàng.",
          temperature: 0.7,
          maxTokens: 500
        }
      };
    }

    // 3. Xây dựng Ngữ cảnh sản phẩm (Product Context) gửi kèm Prompt
    let productContext = "CÁC SẢN PHẨM HIỆN CÓ TẠI CỬA HÀNG:\n";
    if (matchedProducts.length > 0) {
      matchedProducts.forEach((p, idx) => {
        const priceStr = p.discountPrice && p.discountPrice > 0 ? `${p.price} VND (đang giảm giá, giá cũ ${p.discountPrice} VND)` : `${p.price} VND`;
        productContext += `${idx + 1}. ${p.name} - Giá: ${priceStr}\n`;
        productContext += `   - Cấu hình: CPU ${p.specs.cpu || "N/A"}, RAM ${p.specs.ram || "N/A"}, Ổ cứng ${p.specs.storage || "N/A"}, VGA ${p.specs.vga || "N/A"}, Màn hình ${p.specs.screenSize || "N/A"}, HĐH ${p.specs.os || "N/A"}\n`;
        productContext += `   - Link xem chi tiết: /products/${p.slug}\n\n`;
      });
    } else {
      productContext += "(Hiện tại không có sản phẩm nào phù hợp yêu cầu trong kho)\n";
    }

    // 4. Lấy lịch sử hội thoại gần nhất (Memory) để duy trì ngữ cảnh chat
    const session = await ChatbotSession.findOne({ sessionToken });
    const messageHistory = [];
    if (session && session.messages && session.messages.length > 0) {
      // Lấy tối đa 6 tin nhắn gần nhất
      const recentMessages = session.messages.slice(-6);
      recentMessages.forEach((msg) => {
        messageHistory.push({
          role: msg.sender === "user" ? "user" : "assistant",
          content: msg.text,
        });
      });
    }

    // 5. Chuẩn bị danh sách tin nhắn gửi sang Groq API
    const systemInstruction = `${settings.chatbotConfig.systemPrompt}\n\n${productContext}\n*Lưu ý: Chỉ tư vấn và đề xuất các sản phẩm trong danh sách trên của cửa hàng. Cung cấp đường dẫn chi tiết dạng '/products/slug' chính xác như trên. Không được tự bịa ra thông tin sản phẩm khác.`;

    const apiMessages = [
      { role: "system", content: systemInstruction },
      ...messageHistory,
      { role: "user", content: messageText }
    ];

    // 6. Gọi Groq API (sử dụng Model Llama 3)
    const apiKey = (process.env.GROQ_API_KEY || "").trim();
    const apiUrl = (process.env.GROQ_URL || "https://api.groq.com/openai/v1").trim();

    if (!apiKey) {
      throw new Error("GROQ_API_KEY chưa được cấu hình trong file .env");
    }

    const response = await axios.post(
      `${apiUrl}/chat/completions`,
      {
        model: "llama3-8b-8192", // Model hiệu năng cao và phản hồi nhanh trên Groq
        messages: apiMessages,
        temperature: settings.chatbotConfig.temperature,
        max_tokens: settings.chatbotConfig.maxTokens,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const replyText = response.data.choices[0].message.content;

    // Lấy danh sách ID sản phẩm gợi ý (là các sản phẩm ta đã tìm thấy và đưa vào ngữ cảnh)
    const suggestedProductIds = matchedProducts.map((p) => p._id);

    return {
      reply: replyText,
      suggestedProducts: suggestedProductIds,
    };
  } catch (error) {
    console.error("Lỗi khi kết nối với Chatbot LLM:", error.message);
    // Fallback trả lời nếu Groq API gặp sự cố
    return {
      reply: "Xin lỗi bạn, chatbot của hệ thống đang bận xử lý hoặc gặp sự cố kết nối. Bạn vui lòng thử lại sau giây lát!",
      suggestedProducts: [],
    };
  }
};

/**
 * Public/Admin: Get chatbot session messages.
 */
const getSessionMessages = async (sessionToken) => {
  const session = await ChatbotSession.findOne({ sessionToken }).populate("messages.suggestedProducts", "name price images slug");
  if (!session) {
    return [];
  }
  return session.messages;
};

/**
 * Admin: Get list of chatbot sessions.
 */
const getChatSessions = async () => {
  return await ChatbotSession.find()
    .populate("user", "fullName email")
    .sort({ updatedAt: -1 });
};

/**
 * Admin: Retrieve popular question topics (Simple keyphrase extraction from database messages).
 */
const getPopularQuestions = async () => {
  // Aggregate tất cả tin nhắn của người dùng để tìm các cụm từ phổ biến
  const sessions = await ChatbotSession.find().select("messages");
  
  const questionCounts = {};
  sessions.forEach((s) => {
    s.messages.forEach((msg) => {
      if (msg.sender === "user") {
        const text = msg.text.trim().toLowerCase();
        // Chỉ đếm các câu hỏi dài từ 5 ký tự trở lên để tránh lọc từ vô nghĩa
        if (text.length > 5) {
          questionCounts[text] = (questionCounts[text] || 0) + 1;
        }
      }
    });
  });

  // Chuyển sang dạng mảng và sắp xếp giảm dần
  return Object.entries(questionCounts)
    .map(([question, count]) => ({ question, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // Lấy top 10 câu hỏi phổ biến nhất
};

module.exports = {
  getChatbotReply,
  getSessionMessages,
  getChatSessions,
  getPopularQuestions,
};
