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
          model: "llama-3.1-8b-instant",
          systemPrompt: `Bạn là Trợ lý Bán hàng của TechStore.
        
        NGUYÊN TẮC VÀNG:
        1. TRẢ LỜI ĐÚNG TRỌNG TÂM: Không dài dòng, không giải thích lý thuyết. Khách hỏi gì đáp nấy.
        2. SO SÁNH GIÁ CHUẨN XÁC: Hiểu rõ "triệu" hoặc "tr" tương đương với 1.000.000. Phải đối chiếu số tiền khách yêu cầu với "Giá trị số (VNĐ)" của từng sản phẩm. Tuyệt đối KHÔNG giới thiệu sản phẩm có "Giá trị số (VNĐ)" lớn hơn ngân sách khách yêu cầu, KỂ CẢ dưới hình thức gợi ý thêm hay phương án thay thế.
        3. CHỈ DÙNG DỮ LIỆU THẬT & ĐÚNG DANH MỤC: Chỉ được giới thiệu sản phẩm nằm trong danh sách được cung cấp dưới đây và phải khớp đúng danh mục khách yêu cầu (Ví dụ: khách hỏi "laptop" thì tuyệt đối không tư vấn "chuột" hay "vga").
        4. CẤM TUYỆT ĐỐI GIỚI THIỆU VƯỢT NGÂN SÁCH: Nếu không có sản phẩm nào thỏa mãn mức giá yêu cầu, PHẢI TRẢ LỜI THÀNH THẬT là cửa hàng hiện chưa có sản phẩm phù hợp. KHÔNG ĐƯỢC giới thiệu bất kỳ sản phẩm nào đắt hơn ngân sách của khách.
        5. ĐỊNH DẠNG: Luôn dùng link định dạng Markdown và PHẢI KÈM THEO GIÁ SẢN PHẨM (Giá hiển thị). Ví dụ: "- [Tên sản phẩm](/product/slug): 27.990.000₫ - Mô tả ngắn...".
        6. LUÔN CẢM ƠN: Ở cuối mỗi câu trả lời, luôn thêm một câu cảm ơn thân thiện gửi đến khách hàng (Ví dụ: "Cảm ơn bạn đã quan tâm đến sản phẩm của TechStore ạ!", "Cảm ơn bạn nhé!").
        
        VÍ DỤ NẾU KHÔNG CÓ SẢN PHẨM PHÙ HỢP:
        Khách: "Tư vấn chuột dưới 100 nghìn" (trong kho chỉ có chuột 2.390.000₫)
        AI: "Xin lỗi bạn, hiện tại TechStore chưa có mẫu chuột nào có mức giá dưới 100.000₫ phù hợp với yêu cầu của bạn ạ! Bạn có thể cân nhắc nâng thêm ngân sách hoặc theo dõi thêm cửa hàng để cập nhật các mẫu mới nhé. Cảm ơn bạn đã quan tâm đến sản phẩm của TechStore ạ!"

        DANH SÁCH SẢN PHẨM TRONG KHO:
        \${productContext}`,
          temperature: 0,
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
    let systemInstruction = settings.chatbotConfig.systemPrompt || "";
    if (systemInstruction.includes("${productContext}")) {
      systemInstruction = systemInstruction.replace("${productContext}", productContext);
    } else if (systemInstruction.includes("$productContext")) {
      systemInstruction = systemInstruction.replace("$productContext", productContext);
    } else {
      systemInstruction = `${systemInstruction}\n\n${productContext}\n*Lưu ý: Chỉ tư vấn và đề xuất các sản phẩm trong danh sách trên của cửa hàng. Cung cấp đường dẫn chi tiết dạng '/products/slug' chính xác như trên. Không được tự bịa ra thông tin sản phẩm khác.`;
    }

    const apiMessages = [
      { role: "system", content: systemInstruction },
      ...messageHistory,
      { role: "user", content: messageText }
    ];

    // 6. Gọi Groq API
    const apiKey = (process.env.GROQ_API_KEY || "").trim();
    const apiUrl = (process.env.GROQ_URL || "https://api.groq.com/openai/v1").trim();

    if (!apiKey) {
      throw new Error("GROQ_API_KEY chưa được cấu hình trong file .env");
    }

    const modelName = settings.chatbotConfig.model || "llama-3.1-8b-instant";

    const response = await axios.post(
      `${apiUrl}/chat/completions`,
      {
        model: modelName,
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
    if (error.response) {
      console.error(
        "Lỗi từ Groq API:",
        error.response.status,
        JSON.stringify(error.response.data, null, 2)
      );
    } else {
      console.error("Lỗi khi kết nối với Chatbot LLM:", error.message);
    }
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
