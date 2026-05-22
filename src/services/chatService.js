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
    let upsellProducts = [];
    const textLower = messageText.toLowerCase();

    // Phân tích khoảng giá (vd: "dưới 20tr", "dưới 20 triệu", "laptop 20 triệu")
    let maxPrice = null;
    let prices = [];
    
    // 1. Tìm tất cả các mức giá bằng triệu/tr/trieu
    const trieuMatches = [...textLower.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:triệu|tr|trieu)\b/gi)];
    for (const match of trieuMatches) {
      let val = match[1].replace(/[,.]/g, "");
      prices.push(parseFloat(val) * 1000000);
    }
    
    // 2. Tìm tất cả các mức giá bằng nghìn/ngàn/k
    const nghinMatches = [...textLower.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:nghìn|ngàn|k)\b/gi)];
    for (const match of nghinMatches) {
      let val = match[1].replace(/[,.]/g, "");
      prices.push(parseFloat(val) * 1000);
    }
    
    // 3. Tìm tất cả các mức giá bằng đ/đồng/vnd
    const vndMatches = [...textLower.matchAll(/(\d{1,3}(?:\.\d{3})+(?:\.\d{3})?|\d{5,})\s*(?:đ|đồng|vnd)\b/gi)];
    for (const match of vndMatches) {
      let val = match[1].replace(/[,.]/g, "");
      prices.push(parseFloat(val));
    }
    
    if (prices.length > 0) {
      maxPrice = Math.max(...prices);
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

      if (maxPrice) {
        const upsellQuery = { ...query };
        delete upsellQuery.price;
        upsellQuery.price = { $gt: maxPrice, $lte: maxPrice * 1.25 };
        
        upsellProducts = await Product.find(upsellQuery)
          .select("name price discountPrice specs slug description")
          .limit(4);
      }
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

      if (maxPrice) {
        upsellProducts = await Product.find({
          isActive: true,
          price: { $gt: maxPrice, $lte: maxPrice * 1.25 },
          $text: { $search: messageText }
        })
          .select("name price discountPrice specs slug description")
          .limit(3);
      }
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

      if (maxPrice) {
        upsellProducts = await Product.find({
          isActive: true,
          price: { $gt: maxPrice, $lte: maxPrice * 1.25 },
          $or: [
            { isFeatured: true },
            { isBestSeller: true }
          ]
        })
          .select("name price discountPrice specs slug description")
          .limit(3);
      }
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
        2. SO SÁNH GIÁ CHUẨN XÁC: Hiểu rõ "triệu" hoặc "tr" tương đương với 1.000.000. Phải phân biệt rõ ràng giữa sản phẩm "Phù hợp ngân sách" (<= số tiền khách hỏi) và sản phẩm "Vượt ngân sách một chút" (> số tiền khách hỏi).
        3. CHỈ DÙNG DỮ LIỆU THẬT & ĐÚNG DANH MỤC: Chỉ được giới thiệu sản phẩm nằm trong danh sách được cung cấp dưới đây và phải khớp đúng danh mục khách yêu cầu (Ví dụ: khách hỏi "laptop" thì tuyệt đối không tư vấn "chuột" hay "vga").
        4. XỬ LÝ NGÂN SÁCH THÔNG MINH:
           - Nếu có sản phẩm nằm trong danh sách phù hợp với ngân sách của khách (dưới hoặc bằng ngân sách), chỉ giới thiệu những sản phẩm đó.
           - Nếu KHÔNG CÓ sản phẩm nào phù hợp ngân sách, hãy thông báo trung thực là hiện chưa có dòng sản phẩm trong tầm giá khách yêu cầu. ĐỒNG THỜI, hãy gợi ý cho khách hàng là nếu có thể cố gắng "nhích ngân sách lên một chút" tầm khoảng 23 - 24 triệu thì cửa hàng có các dòng máy chất lượng tốt hơn (liệt kê các sản phẩm vượt ngân sách một chút kèm theo giá bán rõ ràng để khách hàng tự so sánh).
        5. ĐỊNH DẠNG: Trình bày danh sách sản phẩm theo dạng danh sách gạch đầu dòng, mỗi sản phẩm viết gọn trên đúng 1 DÒNG duy nhất. Tuyệt đối không xuống dòng hay tạo các dòng phụ thụt lề cho cùng một sản phẩm. Công thức định dạng bắt buộc: "- [Tên sản phẩm](/product/slug): Giá tiền - Mô tả ngắn" (Ví dụ: "- [Laptop Lenovo IdeaPad 330S](/product/lenovo-ideapad-330s): 14.990.000₫ - Laptop thin và nhẹ, hiệu suất mạnh mẽ.").
        6. LUÔN CẢM ƠN: Ở cuối mỗi câu trả lời, luôn thêm một câu cảm ơn thân thiện gửi đến khách hàng (Ví dụ: "Cảm ơn bạn đã quan tâm đến sản phẩm của TechStore ạ!", "Cảm ơn bạn nhé!").
        
        VÍ DỤ NẾU KHÔNG CÓ SẢN PHẨM PHÙ HỢP:
        Khách: "Tư vấn laptop 20 triệu" (trong kho không có máy dưới 20 triệu, chỉ có các dòng máy 23 - 25 triệu)
        AI: "Xin lỗi bạn, hiện tại TechStore chưa có mẫu laptop nào có mức giá dưới 20.000.000₫ phù hợp với yêu cầu của bạn ạ! Tuy nhiên, nếu bạn có thể cân nhắc nhích ngân sách lên một chút tầm khoảng 23 - 24 triệu thì bên mình đang sẵn các dòng laptop cực kỳ chất lượng sau:
        - [Laptop gaming MSI Katana A15 AI B8VE 402VN](/product/laptop-gaming-msi-katana-a15-ai-b8ve-402vn): 23.990.000₫ - Laptop gaming mạnh mẽ với CPU AMD Ryzen R7-8845HS.
        - [Laptop gaming Acer Aspire 7 A715 59G 55MD](/product/laptop-gaming-acer-aspire-7-a715-59g-55md): 24.990.000₫ - Laptop hiệu năng cao, thiết kế bền bỉ.
        
        Bạn xem qua thử nhé. Cảm ơn bạn đã quan tâm đến sản phẩm của TechStore ạ!"

        DANH SÁCH SẢN PHẨM TRONG KHO:
        \${productContext}`,
          temperature: 0.7,
          maxTokens: 500
        }
      };
    }

    // 3. Xây dựng Ngữ cảnh sản phẩm (Product Context) gửi kèm Prompt
    const formatPriceVND = (num) => {
      if (num === null || num === undefined) return "0₫";
      return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "₫";
    };

    let productContext = "";
    if (maxPrice) {
      productContext += `YÊU CẦU NGÂN SÁCH CỦA KHÁCH HÀNG: tối đa ${formatPriceVND(maxPrice)}\n\n`;
    }

    productContext += "DANH SÁCH SẢN PHẨM PHÙ HỢP VỚI NGÂN SÁCH KHÁCH HÀNG (Giá <= ngân sách):\n";
    if (matchedProducts.length > 0) {
      matchedProducts.forEach((p, idx) => {
        const displayPrice = formatPriceVND(p.price);
        const originalPrice = p.discountPrice && p.discountPrice > 0 ? formatPriceVND(p.discountPrice) : null;
        
        let priceStr = displayPrice;
        if (originalPrice) {
          priceStr = `${displayPrice} (đang giảm giá, giá cũ ${originalPrice})`;
        }
        
        productContext += `- ${p.name} - Giá trị số (VNĐ): ${p.price} (${priceStr})\n`;
        productContext += `  Cấu hình: CPU ${p.specs.cpu || "N/A"}, RAM ${p.specs.ram || "N/A"}, Ổ cứng ${p.specs.storage || "N/A"}, VGA ${p.specs.vga || "N/A"}, Màn hình ${p.specs.screenSize || "N/A"}, HĐH ${p.specs.os || "N/A"}\n`;
        productContext += `  Link xem chi tiết: /product/${p.slug}\n\n`;
      });
    } else {
      productContext += "(Không có sản phẩm nào phù hợp ngân sách của khách hàng trong kho)\n\n";
    }

    if (maxPrice && upsellProducts.length > 0) {
      productContext += "DANH SÁCH SẢN PHẨM VƯỢT NGÂN SÁCH MỘT CHÚT (Để gợi ý thêm khi khách hàng hỏi nhưng không có máy phù hợp budget. Thường đắt hơn khoảng 10-25%): \n";
      upsellProducts.forEach((p, idx) => {
        const displayPrice = formatPriceVND(p.price);
        const originalPrice = p.discountPrice && p.discountPrice > 0 ? formatPriceVND(p.discountPrice) : null;
        
        let priceStr = displayPrice;
        if (originalPrice) {
          priceStr = `${displayPrice} (đang giảm giá, giá cũ ${originalPrice})`;
        }
        
        productContext += `- ${p.name} - Giá trị số (VNĐ): ${p.price} (${priceStr})\n`;
        productContext += `  Cấu hình: CPU ${p.specs.cpu || "N/A"}, RAM ${p.specs.ram || "N/A"}, Ổ cứng ${p.specs.storage || "N/A"}, VGA ${p.specs.vga || "N/A"}, Màn hình ${p.specs.screenSize || "N/A"}, HĐH ${p.specs.os || "N/A"}\n`;
        productContext += `  Link xem chi tiết: /product/${p.slug}\n\n`;
      });
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

    // Lấy danh sách ID sản phẩm gợi ý (bao gồm cả sản phẩm khớp và sản phẩm gợi ý thêm)
    const suggestedProductIds = [...matchedProducts, ...upsellProducts].map((p) => p._id);

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
