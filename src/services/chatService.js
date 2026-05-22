const axios = require("axios");
const Product = require("../../models/product");
const SystemSettings = require("../../models/systemSettings");
const ChatbotSession = require("../../models/chatbotSession");
const Category = require("../../models/category");
const Brand = require("../../models/brand");

/**
 * Perform RAG: Retrieve relevant products, build prompt, call LLM.
 */
const getChatbotReply = async (sessionToken, messageText) => {
  try {
    // 1. Phân tích từ khóa tìm kiếm nâng cao (Retrieval)
    let matchedProducts = [];
    const textLower = messageText.toLowerCase();

    // Phân tích khoảng giá (vd: "dưới 20tr", "dưới 20 triệu")
    let maxPrice = null;
    const priceRegexes = [
      /dưới\s*(\d+(?:[.,]\d+)?)\s*(?:triệu|tr)/i,
      /tầm\s*(\d+(?:[.,]\d+)?)\s*(?:triệu|tr)/i,
      /khoảng\s*(\d+(?:[.,]\d+)?)\s*(?:triệu|tr)/i,
      /dưới\s*(\d{1,3}(?:\.\d{3})+(?:\.\d{3})?)\s*(?:đ|đồng|vnd)/i,
      /dưới\s*(\d+)\s*(?:triệu|tr|trieu)/i
    ];
    
    for (const regex of priceRegexes) {
      const match = textLower.match(regex);
      if (match) {
        let val = match[1].replace(/[,.]/g, "");
        const floatVal = parseFloat(val);
        if (regex.source.includes("triệu") || regex.source.includes("tr")) {
          maxPrice = floatVal * 1000000;
        } else {
          maxPrice = floatVal;
        }
        break;
      }
    }

    // Phân tích danh mục (vd: "laptop", "pc", "chuột", "bàn phím"...)
    const categoryKeywords = {
      "laptop": ["laptop-gaming", "laptop-van-phong", "macbook"],
      "macbook": ["macbook"],
      "pc": ["pc-dong-bo"],
      "máy tính bàn": ["pc-dong-bo"],
      "màn hình": ["man-hinh"],
      "chuột": ["phu-kien"],
      "bàn phím": ["phu-kien"],
      "tai nghe": ["phu-kien"],
      "vga": ["linh-kien-pc"],
      "card": ["linh-kien-pc"],
      "ram": ["linh-kien-pc"],
      "ssd": ["linh-kien-pc"],
    };

    const matchedSlugs = [];
    for (const [key, slugs] of Object.entries(categoryKeywords)) {
      if (textLower.includes(key)) {
        matchedSlugs.push(...slugs);
      }
    }

    let categoryIds = [];
    if (matchedSlugs.length > 0) {
      const cats = await Category.find({ slug: { $in: matchedSlugs } }).select("_id");
      categoryIds = cats.map(c => c._id);
    }

    // Phân tích thương hiệu (vd: "asus", "dell", "hp", "lenovo"...)
    const brandsInDb = await Brand.find({}).select("_id name");
    const matchedBrandIds = [];
    for (const brand of brandsInDb) {
      if (textLower.includes(brand.name.toLowerCase())) {
        matchedBrandIds.push(brand._id);
      }
    }

    // Xây dựng câu truy vấn động
    const query = { isActive: true };
    if (categoryIds.length > 0) {
      query.category = { $in: categoryIds };
    }
    if (matchedBrandIds.length > 0) {
      query.brand = { $in: matchedBrandIds };
    }
    if (maxPrice) {
      query.price = { $lte: maxPrice };
    }

    // Thực hiện tìm kiếm nâng cao theo bộ lọc trước
    if (categoryIds.length > 0 || matchedBrandIds.length > 0 || maxPrice) {
      matchedProducts = await Product.find(query)
        .select("name price discountPrice specs slug description")
        .limit(6);
    }

    // Nếu bộ lọc không ra kết quả hoặc không có bộ lọc cụ thể, dùng Text Index
    if (matchedProducts.length === 0 && messageText && messageText.trim() !== "") {
      const textQuery = { isActive: true };
      if (maxPrice) {
        textQuery.price = { $lte: maxPrice };
      }
      matchedProducts = await Product.find({
        ...textQuery,
        $text: { $search: messageText }
      })
        .select("name price discountPrice specs slug description")
        .limit(4);
    }

    // Fallback cuối cùng nếu vẫn không có sản phẩm nào
    if (matchedProducts.length === 0) {
      const fallbackQuery = { isActive: true };
      if (maxPrice) {
        fallbackQuery.price = { $lte: maxPrice };
      }
      matchedProducts = await Product.find({
        ...fallbackQuery,
        $or: [
          { isFeatured: true },
          { isBestSeller: true }
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
        5. ĐỊNH DẠNG: Trình bày danh sách sản phẩm theo dạng danh sách gạch đầu dòng, mỗi sản phẩm viết gọn trên đúng 1 DÒNG duy nhất. Tuyệt đối không xuống dòng hay tạo các dòng phụ thụt lề cho cùng một sản phẩm. Công thức định dạng bắt buộc: "- [Tên sản phẩm](/product/slug): Giá tiền - Mô tả ngắn" (Ví dụ: "- [Laptop Lenovo IdeaPad 330S](/product/lenovo-ideapad-330s): 14.990.000₫ - Laptop thin và nhẹ, hiệu suất mạnh mẽ.").
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
    const formatPriceVND = (num) => {
      if (num === null || num === undefined) return "0₫";
      return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "₫";
    };

    let productContext = "CÁC SẢN PHẨM HIỆN CÓ TẠI CỬA HÀNG:\n";
    if (matchedProducts.length > 0) {
      matchedProducts.forEach((p, idx) => {
        const displayPrice = formatPriceVND(p.price);
        const originalPrice = p.discountPrice && p.discountPrice > 0 ? formatPriceVND(p.discountPrice) : null;
        
        let priceStr = displayPrice;
        if (originalPrice) {
          priceStr = `${displayPrice} (đang giảm giá, giá cũ ${originalPrice})`;
        }
        
        productContext += `${idx + 1}. ${p.name} - Giá trị số (VNĐ): ${p.price} (${priceStr})\n`;
        productContext += `   - Cấu hình: CPU ${p.specs.cpu || "N/A"}, RAM ${p.specs.ram || "N/A"}, Ổ cứng ${p.specs.storage || "N/A"}, VGA ${p.specs.vga || "N/A"}, Màn hình ${p.specs.screenSize || "N/A"}, HĐH ${p.specs.os || "N/A"}\n`;
        productContext += `   - Link xem chi tiết: /product/${p.slug}\n\n`;
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
      systemInstruction = `${systemInstruction}\n\n${productContext}\n*Lưu ý: Chỉ tư vấn và đề xuất các sản phẩm trong danh sách trên của cửa hàng. Cung cấp đường dẫn chi tiết dạng '/product/slug' chính xác như trên. Không được tự bịa ra thông tin sản phẩm khác.`;
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
