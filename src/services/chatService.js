const axios = require("axios");
const Product = require("../models/product");
const SystemSettings = require("../models/systemSettings");
const ChatbotSession = require("../models/chatbotSession");
const Category = require("../models/category");
const Brand = require("../models/brand");
const Order = require("../models/order");

// Helper to strip Vietnamese diacritics for easier parsing
const stripDiacritics = (str) => {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
};

// Helper to convert number and unit to numeric value
const getPriceVal = (numStr, unitStr) => {
  let val = numStr.replace(/[,.]/g, "");
  let num = parseFloat(val);
  if (!unitStr) return num;
  const u = unitStr.toLowerCase();
  if (u === "trieu" || u === "tr" || u === "trieu") {
    return num * 1000000;
  }
  if (u === "nghin" || u === "ngan" || u === "k") {
    return num * 1000;
  }
  return num; // d, dong, vnd
};

// Helper to format price to VND currency string
const formatPriceVND = (num) => {
  if (num === null || num === undefined) return "0₫";
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "₫";
};

// Helper to filter products by specific component keywords (to avoid cross-matching inside same category)
const filterByComponentKeywords = (products, textLower) => {
  const textNormalized = stripDiacritics(textLower);
  if (textNormalized.includes("ram") || textNormalized.includes("ddr")) {
    return products.filter(p => {
      const nameNorm = stripDiacritics(p.name.toLowerCase());
      return nameNorm.includes("ram") || nameNorm.includes("ddr");
    });
  }
  if (textNormalized.includes("ssd") || textNormalized.includes("o cung")) {
    return products.filter(p => {
      const nameNorm = stripDiacritics(p.name.toLowerCase());
      return nameNorm.includes("ssd") || nameNorm.includes("o cung");
    });
  }
  if (textNormalized.includes("vga") || textNormalized.includes("card man hinh") || textNormalized.includes("card do hoa")) {
    return products.filter(p => {
      const nameNorm = stripDiacritics(p.name.toLowerCase());
      return nameNorm.includes("vga") || nameNorm.includes("card") || nameNorm.includes("geforce") || nameNorm.includes("rtx") || nameNorm.includes("rx");
    });
  }
  return products;
};

/**
 * Perform RAG: Retrieve relevant products, build prompt, call LLM.
 */
const getChatbotReply = async (sessionOrToken, messageText) => {
  try {
    let session;
    if (typeof sessionOrToken === "string") {
      session = await ChatbotSession.findOne({ sessionToken: sessionOrToken });
    } else {
      session = sessionOrToken;
    }

    if (!session) {
      throw new Error("Không tìm thấy session hội thoại");
    }

    const textLower = messageText.toLowerCase();
    const textNormalized = stripDiacritics(textLower);

    // Khởi tạo metadata nếu chưa có
    if (!session.metadata) {
      session.metadata = {};
    }

    const metadata = session.metadata;
    const isBuilding = metadata.isBuildingPC || false;
    const currentStep = metadata.buildStep || 0;

    // Regex tìm khoảng giá dạng: từ 15 đến 25 triệu, từ 15tr tới 20tr
    const rangeRegex = /(\d+(?:[.,]\d+)?)\s*(trieu|tr|nghin|ngan|k|d|dong|vnd)?\s*(?:den|toi|tam|-)\s*(\d+(?:[.,]\d+)?)\s*(trieu|tr|nghin|ngan|k|d|dong|vnd)/gi;

    // Luồng tự động Build PC / Laptop
    if (isBuilding) {
      if (currentStep === 1) {
        // Xử lý Bước 1: Trích xuất ngân sách
        let budgetVal = null;
        let budgetMin = 0;
        let budgetMax = 0;

        const rangeMatch = rangeRegex.exec(textNormalized);
        rangeRegex.lastIndex = 0; // reset
        if (rangeMatch) {
          budgetMin = getPriceVal(rangeMatch[1], rangeMatch[2] || rangeMatch[4]);
          budgetMax = getPriceVal(rangeMatch[3], rangeMatch[4]);
          budgetVal = (budgetMin + budgetMax) / 2;
        } else {
          const priceRegex = /(\d+(?:[.,]\d+)?)\s*(trieu|tr|nghin|ngan|k|d|dong|vnd)/gi;
          const matches = [...textNormalized.matchAll(priceRegex)];
          if (matches.length > 0) {
            budgetMax = getPriceVal(matches[0][1], matches[0][2]);
            budgetVal = budgetMax;
          }
        }

        if (!budgetVal) {
          return {
            reply: `Ngân sách của bạn chưa rõ ràng. Bạn vui lòng nhập số tiền cụ thể (ví dụ: 15 triệu, 20 triệu, hoặc 15 - 25 triệu) để mình hỗ trợ nhé!`,
            suggestedProducts: []
          };
        }

        session.metadata.budget = budgetVal;
        session.metadata.budgetMin = budgetMin;
        session.metadata.budgetMax = budgetMax;
        session.metadata.buildStep = 2;
        session.markModified("metadata");

        if (session.metadata.buildType === "laptop") {
          return {
            reply: `Bước 2: Bạn muốn sử dụng chiếc Laptop này cho nhu cầu chính là gì?\n(Ví dụ: Học tập, văn phòng mỏng nhẹ / Chơi game giải trí, đồ họa / Lập trình, kỹ thuật...)`,
            suggestedProducts: []
          };
        } else {
          return {
            reply: `Bước 2: Ngân sách này bạn muốn bao gồm những gì?\n(Ví dụ: Chỉ case máy tính / Cả màn hình / Kèm phím chuột tai nghe...)`,
            suggestedProducts: []
          };
        }
      } 
      
      if (currentStep === 2) {
        // Xử lý Bước 2: Hoàn tất thu thập thông tin và thực hiện Build PC/Laptop
        const finalBudVal = session.metadata.budget || 15000000;
        const finalBuildType = session.metadata.buildType || "pc";
        const finalIncludes = messageText;

        // Reset trạng thái build
        session.metadata.isBuildingPC = false;
        session.metadata.buildStep = 0;
        session.markModified("metadata");

        // Lấy tất cả sản phẩm đang kích hoạt trong kho để làm ngữ cảnh
        const allProducts = await Product.find({ isActive: true })
          .populate("category")
          .select("name price discountPrice specs slug category");

        let storeProductsContext = "DANH SÁCH LINH KIỆN & SẢN PHẨM TRONG KHO TECHSTORE:\n";
        allProducts.forEach((p) => {
          storeProductsContext += `- [${p.name}](/product/${p.slug}) | Giá: ${formatPriceVND(p.price)} | Phân loại: ${p.category?.name || "N/A"}\n`;
        });

        // Xây dựng Prompt sinh cấu hình chuyên dụng
        const systemPrompt = `Bạn là Trợ lý Thiết kế Cấu hình Phần cứng chuyên nghiệp của TechStore.
        
        Nhiệm vụ của bạn là:
        1. Thiết kế một cấu hình ${finalBuildType === "laptop" ? "Laptop" : "PC"} hoàn chỉnh và tối ưu nhất cho khách hàng với ngân sách là ${formatPriceVND(finalBudVal)}. ${finalBuildType === "laptop" ? `Khách hàng yêu cầu thiết bị phải đáp ứng nhu cầu: ${finalIncludes}.` : `Khách hàng yêu cầu bộ sản phẩm phải bao gồm: ${finalIncludes}.`}
        2. Các linh kiện được chọn phải tương thích hoàn toàn về mặt kỹ thuật (Ví dụ: CPU và Mainboard khớp socket, RAM đúng chuẩn DDR4/DDR5 hỗ trợ, PSU đủ công suất gánh VGA, kích thước VGA vừa vỏ case).
        3. Sử dụng tối đa các linh kiện thực tế đang bán tại TechStore được cung cấp trong danh sách kho bên dưới. Nếu một linh kiện nào đó thiếu trong kho (ví dụ: Mainboard, nguồn, tản nhiệt), bạn được phép đề xuất linh kiện chất lượng thực tế ngoài thị trường và ước lượng giá hợp lý.
        4. BẮT BUỘC chèn đường dẫn liên kết dạng markdown: [Tên linh kiện](/product/slug) đối với bất kỳ sản phẩm nào có trong danh sách kho TechStore dưới đây để khách hàng click mua được ngay.
        5. ĐỊNH DẠNG cấu trả lời:
           - Chào khách hàng thân thiện và tóm tắt ngắn gọn cấu hình.
           - Liệt kê cấu hình chi tiết theo dạng danh sách gạch đầu dòng rõ ràng.
           - Với mỗi linh kiện trong cấu hình, ghi rõ: Tên linh kiện, lý do chọn, giá bán.
           - Tính tổng chi phí dự kiến cho toàn bộ cấu hình.
           - Đưa ra phần "Tính tương thích của cấu hình" để giải thích rõ vì sao các linh kiện hoạt động tốt cùng nhau.
           - Đưa ra dự kiến FPS cho các game phổ biến (như Valorant, Liên Minh Huyền Thoại, CS2, Cyberpunk 2077) để chứng minh hiệu năng.
           - Kết thúc bằng một câu cảm ơn lịch sự.
           
        ${storeProductsContext}`;

        // Lấy cấu hình hệ thống
        let settings = await SystemSettings.findOne();
        const modelName = settings?.chatbotConfig?.model || "llama-3.1-8b-instant";
        const apiKey = (process.env.GROQ_API_KEY || "").trim();
        const apiUrl = (process.env.GROQ_URL || "https://api.groq.com/openai/v1").trim();

        if (!apiKey) {
          throw new Error("GROQ_API_KEY chưa được cấu hình trong file .env");
        }

        // Tạo hội thoại gửi API
        const apiMessages = [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Tôi có ngân sách ${formatPriceVND(finalBudVal)}, muốn build ${finalBuildType === "laptop" ? "Laptop" : "PC"} bao gồm: ${finalIncludes}.` }
        ];

        const response = await axios.post(
          `${apiUrl}/chat/completions`,
          {
            model: modelName,
            messages: apiMessages,
            temperature: 0.7,
            max_tokens: 1500,
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
          }
        );

        const replyText = response.data.choices[0].message.content;

        // Hậu xử lý: Chuyển các đường dẫn sản phẩm ảo thành chữ in đậm thường (tránh link 404)
        let sanitizedReplyText = replyText;
        const linkRegex = /\[([^\]]+)\]\(\/product\/([a-zA-Z0-9_\-]+)\)/g;
        const dbSlugs = new Set(allProducts.map(p => p.slug));

        sanitizedReplyText = replyText.replace(linkRegex, (match, displayName, slug) => {
          if (dbSlugs.has(slug)) {
            return match;
          } else {
            return `**${displayName}**`;
          }
        });

        // Trả về cấu hình hoàn chỉnh
        return {
          reply: sanitizedReplyText,
          suggestedProducts: allProducts.filter(p => sanitizedReplyText.includes(p.slug)).map(p => p._id)
        };
      }
    }

    // Kiểm tra ý định bắt đầu quy trình build / tư vấn chọn máy
    const isStartBuildQuery = /build\s*(pc|laptop|may\s*tinh|cau\s*hinh)|tu\s*van\s*(mua\s*)?(pc|laptop|may\s*tinh|cau\s*hinh)|tao\s*(cau\s*hinh|pc|laptop)|mua\s*(pc|laptop)/i.test(textNormalized);
    if (isStartBuildQuery) {
      const buildType = textNormalized.includes("laptop") ? "laptop" : "pc";
      session.metadata = {
        isBuildingPC: true,
        buildStep: 1,
        buildType: buildType
      };
      session.markModified("metadata");

      const actionName = buildType === "laptop" ? "Tư vấn chọn mua Laptop" : "Tự động Build PC";

      return {
        reply: `🛠️ Bắt đầu quy trình ${actionName}\n\nBước 1: Ngân sách dự kiến của bạn là bao nhiêu?`,
        suggestedProducts: []
      };
    }

    // 1. Phân tích từ khóa tìm kiếm nâng cao (Retrieval)
    let matchedProducts = [];
    let upsellProducts = [];
    // Phân tích khoảng giá (vd: "dưới 20tr", "trên 15 triệu", "từ 15 đến 25 triệu")
    let minPrice = null;
    let maxPrice = null;

    rangeRegex.lastIndex = 0;
    const rangeMatch = rangeRegex.exec(textNormalized);

    if (rangeMatch) {
      const num1Str = rangeMatch[1];
      const unit1Str = rangeMatch[2] || rangeMatch[4];
      const num2Str = rangeMatch[3];
      const unit2Str = rangeMatch[4];

      minPrice = getPriceVal(num1Str, unit1Str);
      maxPrice = getPriceVal(num2Str, unit2Str);
    } else {
      // Tìm các mức giá đơn lẻ
      const priceRegex = /(\d+(?:[.,]\d+)?)\s*(trieu|tr|nghin|ngan|k|d|dong|vnd)/gi;
      const matches = [...textNormalized.matchAll(priceRegex)];

      if (matches.length > 0) {
        const match = matches[0];
        const valStr = match[1];
        const unitStr = match[2];
        const priceVal = getPriceVal(valStr, unitStr);

        const index = match.index;
        const subBefore = textNormalized.substring(Math.max(0, index - 20), index);
        const subAfter = textNormalized.substring(index + match[0].length, index + match[0].length + 20);

        const isAbove = /tren|hon|lon hon|cao hon|toi thieu/i.test(subBefore) || /tro len|tro di|tren|hon/i.test(subAfter);
        const isBelow = /duoi|thap hon|nho hon|toi da/i.test(subBefore) || /tro xuong|do lai/i.test(subAfter);

        if (isAbove) {
          minPrice = priceVal;
        } else if (isBelow) {
          maxPrice = priceVal;
        } else {
          maxPrice = priceVal;
        }
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

    // Phân tích các tiêu chí lọc đặc biệt
    const isBestSellerQuery = /ban chay|best\s*seller|bestseller/i.test(textNormalized);
    const isFeaturedQuery = /noi bat|featured|hot/i.test(textNormalized);
    const isNewQuery = /moi nhat|moi ve|new/i.test(textNormalized);

    let bestSellerProductIds = [];
    if (isBestSellerQuery) {
      try {
        const topSales = await Order.aggregate([
          { $unwind: "$items" },
          {
            $group: {
              _id: "$items.product",
              totalSold: { $sum: "$items.quantity" }
            }
          },
          { $sort: { totalSold: -1 } },
          { $limit: 10 }
        ]);
        bestSellerProductIds = topSales.map(item => item._id).filter(id => id !== null);
      } catch (err) {
        console.error("Lỗi khi aggregate tìm best seller:", err);
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
    if (minPrice !== null || maxPrice !== null) {
      query.price = {};
      if (minPrice !== null) {
        query.price.$gte = minPrice;
      }
      if (maxPrice !== null) {
        query.price.$lte = maxPrice;
      }
    }
    if (isBestSellerQuery) {
      if (bestSellerProductIds.length > 0) {
        query._id = { $in: bestSellerProductIds };
      } else {
        query.isBestSeller = true;
      }
    }
    if (isFeaturedQuery) {
      query.isFeatured = true;
    }
    if (isNewQuery) {
      query.isNewArrival = true;
    }

    // Nhận dạng tin nhắn chào hỏi/xã giao (Small Talk) để bypass RAG
    const smallTalkKeywords = ["chào", "hello", "hi", "hey", "cảm ơn", "cám ơn", "thank", "bye", "tạm biệt", "bạn là ai", "tên gì", "admin", "chủ shop"];
    const cleanText = textLower.trim();
    const hasFilters = categoryIds.length > 0 || 
                       matchedBrandIds.length > 0 || 
                       minPrice !== null || 
                       maxPrice !== null ||
                       isBestSellerQuery ||
                       isFeaturedQuery ||
                       isNewQuery;
    
    // Nếu không khớp bộ lọc cụ thể nào, và tin nhắn quá ngắn hoặc chứa từ khóa xã giao
    const isSmallTalk = !hasFilters && (
      cleanText.length < 15 || 
      smallTalkKeywords.some(keyword => 
        cleanText === keyword || 
        cleanText.startsWith(keyword + " ") || 
        cleanText.endsWith(" " + keyword) || 
        cleanText.includes(" " + keyword + " ")
      )
    );

    let isRAGSkipped = false;
    if (isSmallTalk) {
      isRAGSkipped = true;
    } else {
      // Thực hiện tìm kiếm nâng cao theo bộ lọc trước
      if (categoryIds.length > 0 || matchedBrandIds.length > 0 || minPrice !== null || maxPrice !== null || isBestSellerQuery || isFeaturedQuery || isNewQuery) {
        matchedProducts = await Product.find(query)
          .select("name price discountPrice specs slug")
          .limit(5);

        if (maxPrice) {
          const upsellQuery = { ...query };
          delete upsellQuery.price;
          upsellQuery.price = { $gt: maxPrice, $lte: maxPrice * 1.25 };
          
          upsellProducts = await Product.find(upsellQuery)
            .select("name price discountPrice specs slug")
            .limit(2);
        }
      }

      // Nếu bộ lọc không ra kết quả hoặc không có bộ lọc cụ thể, dùng Text Index
      if (matchedProducts.length === 0 && messageText && messageText.trim() !== "") {
        const textQuery = { isActive: true };
        if (minPrice !== null || maxPrice !== null) {
          textQuery.price = {};
          if (minPrice !== null) textQuery.price.$gte = minPrice;
          if (maxPrice !== null) textQuery.price.$lte = maxPrice;
        }
        if (isBestSellerQuery) textQuery.isBestSeller = true;
        if (isFeaturedQuery) textQuery.isFeatured = true;
        if (isNewQuery) textQuery.isNewArrival = true;

        matchedProducts = await Product.find({
          ...textQuery,
          $text: { $search: messageText }
        })
          .select("name price discountPrice specs slug")
          .limit(5);

        if (maxPrice) {
          upsellProducts = await Product.find({
            isActive: true,
            price: { $gt: maxPrice, $lte: maxPrice * 1.25 },
            $text: { $search: messageText }
          })
            .select("name price discountPrice specs slug")
            .limit(2);
        }
      }

      // Fallback cuối cùng nếu vẫn không có sản phẩm nào
      if (matchedProducts.length === 0) {
        // Chỉ fallback lấy sản phẩm bán chạy/nổi bật khi tin nhắn có xu hướng tìm kiếm mua bán sản phẩm
        const productRelatedKeywords = ["sản phẩm", "bán chạy", "nổi bật", "cửa hàng", "shop", "có gì", "tư vấn", "laptop", "máy tính", "phụ kiện", "vga", "ram", "ssd", "chuột", "phím", "tai nghe", "loại nào"];
        const isProductQuery = productRelatedKeywords.some(keyword => textLower.includes(keyword)) || textLower.length > 15;

        if (isProductQuery) {
          const fallbackQuery = { isActive: true };
          if (minPrice !== null || maxPrice !== null) {
            fallbackQuery.price = {};
            if (minPrice !== null) fallbackQuery.price.$gte = minPrice;
            if (maxPrice !== null) fallbackQuery.price.$lte = maxPrice;
          }
          if (isBestSellerQuery) fallbackQuery.isBestSeller = true;
          if (isFeaturedQuery) fallbackQuery.isFeatured = true;
          if (isNewQuery) fallbackQuery.isNewArrival = true;

          matchedProducts = await Product.find({
            ...fallbackQuery,
            $or: [
              { isFeatured: true },
              { isBestSeller: true }
            ]
          })
            .select("name price discountPrice specs slug")
            .limit(5);

          if (maxPrice) {
            upsellProducts = await Product.find({
              isActive: true,
              price: { $gt: maxPrice, $lte: maxPrice * 1.25 },
              $or: [
                { isFeatured: true },
                { isBestSeller: true }
              ]
            })
              .select("name price discountPrice specs slug")
              .limit(2);
          }
        } else {
          isRAGSkipped = true;
        }
      }
    }

    // Áp dụng bộ lọc từ khóa chéo cho linh kiện
    if (!isRAGSkipped) {
      matchedProducts = filterByComponentKeywords(matchedProducts, textLower);
      upsellProducts = filterByComponentKeywords(upsellProducts, textLower);
    }

    // Sắp xếp matchedProducts theo thứ tự bán chạy nhất từ orders nếu đây là best seller query
    if (isBestSellerQuery && bestSellerProductIds.length > 0 && matchedProducts.length > 0) {
      matchedProducts.sort((a, b) => {
        const indexA = bestSellerProductIds.findIndex(id => id.toString() === a._id.toString());
        const indexB = bestSellerProductIds.findIndex(id => id.toString() === b._id.toString());
        const posA = indexA === -1 ? 999 : indexA;
        const posB = indexB === -1 ? 999 : indexB;
        return posA - posB;
      });
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
        4. XỬ LÝ NGÂN SÁCH THÔNG MINH & PHÂN BIỆT GIÁ:
           - Nếu có sản phẩm nằm trong danh sách phù hợp với ngân sách của khách (dưới hoặc bằng ngân sách), BẮT BUỘC phải giới thiệu những sản phẩm đó đầu tiên (cho dù giá của chúng rất rẻ chỉ vài nghìn đồng, vẫn coi là sản phẩm hợp lệ của cửa hàng). Tuyệt đối KHÔNG được nói "xin lỗi không có sản phẩm nào" khi danh sách sản phẩm phù hợp không trống.
           - Sau khi giới thiệu sản phẩm phù hợp, nếu có danh sách sản phẩm vượt ngân sách một chút, hãy gợi ý thêm ở phía dưới để khách tham khảo (Ví dụ: "Ngoài ra, nếu quý khách có thể nhích ngân sách lên một chút...").
           - Chỉ khi danh sách sản phẩm phù hợp hoàn toàn TRỐNG thì mới được nói "Xin lỗi bạn, hiện tại TechStore chưa có mẫu laptop nào dưới X phù hợp...".
        5. ĐỊNH DẠNG: Trình bày danh sách sản phẩm theo dạng danh sách gạch đầu dòng, mỗi sản phẩm viết gọn trên đúng 1 DÒNG duy nhất. Tuyệt đối không xuống dòng hay tạo các dòng phụ thụt lề cho cùng một sản phẩm. Công thức định dạng bắt buộc: "- [Tên sản phẩm](/product/slug): Giá tiền - Mô tả ngắn" (Ví dụ: "- [Laptop Lenovo IdeaPad 330S](/product/lenovo-ideapad-330s): 14.990.000₫ - Laptop thin và nhẹ, hiệu suất mạnh mẽ.").
        6. LUÔN CẢM ƠN: Ở cuối mỗi câu trả lời, luôn thêm một câu cảm ơn thân thiện gửi đến khách hàng (Ví dụ: "Cảm ơn bạn đã quan tâm đến sản phẩm của TechStore ạ!", "Cảm ơn bạn nhé!").
        
        VÍ DỤ NẾU CÓ CẢ SẢN PHẨM PHÙ HỢP VÀ SẢN PHẨM VƯỢT NGÂN SÁCH:
        Khách: "Tư vấn laptop dưới 20 triệu"
        AI: "Chào bạn, TechStore đang sẵn có các mẫu sản phẩm phù hợp với ngân sách dưới 20.000.000₫ của bạn đây ạ:
        - [Asus](/product/asus): 20.000₫ - Laptop Asus cấu hình cơ bản.
        - [Laptop 15](/product/laptop-15): 2.000₫ - Laptop 15 cấu hình văn phòng.
        
        Ngoài ra, nếu bạn có thể cân nhắc nhích ngân sách lên một chút tầm khoảng 23 - 24 triệu thì bên mình có thêm các dòng laptop gaming cực kỳ chất lượng và mạnh mẽ hơn sau:
        - [Laptop gaming MSI Katana A15 AI B8VE 402VN](/product/laptop-gaming-msi-katana-a15-ai-b8ve-402vn): 23.990.000₫ - Laptop gaming mạnh mẽ với CPU AMD Ryzen R7-8845HS.
        - [Laptop gaming Acer Aspire 7 A715 59G 55MD](/product/laptop-gaming-acer-aspire-7-a715-59g-55md): 24.990.000₫ - Laptop hiệu năng cao, thiết kế bền bỉ.
        
        Bạn xem qua thử nhé. Cảm ơn bạn đã quan tâm đến sản phẩm của TechStore ạ!"
        
        VÍ DỤ NẾU KHÔNG CÓ SẢN PHẨM PHÙ HỢP TRONG TẦM GIÁ YÊU CẦU:
        Khách: "Tư vấn laptop 10 triệu" (trong kho không có máy dưới 10 triệu, chỉ có các dòng máy từ 15 triệu trở lên)
        AI: "Xin lỗi bạn, hiện tại TechStore chưa có mẫu laptop nào có mức giá dưới 10.000.000₫ phù hợp với yêu cầu của bạn ạ! Tuy nhiên, nếu bạn có thể cân nhắc nhích ngân sách lên một chút tầm khoảng 15 triệu thì bên mình đang sẵn các dòng laptop cực kỳ chất lượng trong tầm giá đó:
        - [Laptop Acer Aspire 3](/product/laptop-acer-aspire-3): 15.490.000₫ - Laptop văn phòng mỏng nhẹ, hiệu năng ổn định.
        
        Bạn xem qua thử nhé. Cảm ơn bạn đã quan tâm đến sản phẩm của TechStore ạ!"
        
        DANH SÁCH SẢN PHẨM TRONG KHO:
        \${productContext}`,
          temperature: 0.7,
        }
      };
    }

    // 3. Xây dựng Ngữ cảnh sản phẩm (Product Context) gửi kèm Prompt

    let productContext = "";
    if (isRAGSkipped) {
      productContext = "(Khách đang chào hỏi xã giao hoặc trò chuyện thông thường, không hỏi về sản phẩm cụ thể. Bạn không cần liệt kê sản phẩm nào từ kho, hãy trả lời xã giao ngắn gọn, thân thiện và sẵn sàng tư vấn khi họ cần.)";
    } else {
      let filterDescriptions = [];
      if (minPrice !== null && maxPrice !== null) {
        filterDescriptions.push(`từ ${formatPriceVND(minPrice)} đến ${formatPriceVND(maxPrice)}`);
      } else if (minPrice !== null) {
        filterDescriptions.push(`tối thiểu từ ${formatPriceVND(minPrice)}`);
      } else if (maxPrice !== null) {
        filterDescriptions.push(`tối đa ${formatPriceVND(maxPrice)}`);
      }

      if (isBestSellerQuery) filterDescriptions.push("bán chạy nhất");
      if (isFeaturedQuery) filterDescriptions.push("nổi bật/hot");
      if (isNewQuery) filterDescriptions.push("mới về/mới nhất");

      if (filterDescriptions.length > 0) {
        productContext += `YÊU CẦU LỌC CỦA KHÁCH HÀNG: ${filterDescriptions.join(", ")}\n\n`;
      }

      productContext += "DANH SÁCH SẢN PHẨM PHÙ HỢP VỚI YÊU CẦU CỦA KHÁCH HÀNG:\n";
      if (matchedProducts.length > 0) {
        matchedProducts.forEach((p, idx) => {
          const displayPrice = formatPriceVND(p.price);
          const originalPrice = p.discountPrice && p.discountPrice > 0 ? formatPriceVND(p.discountPrice) : null;
          
          let priceStr = displayPrice;
          if (originalPrice) {
            priceStr = `${displayPrice} (giảm từ ${originalPrice})`;
          }
          
          productContext += `- [${p.name}](/product/${p.slug}): ${priceStr} - CPU ${p.specs.cpu || "N/A"}, RAM ${p.specs.ram || "N/A"}, SSD ${p.specs.storage || "N/A"}, VGA ${p.specs.vga || "N/A"}, Màn hình ${p.specs.screenSize || "N/A"}\n`;
        });
      } else {
        productContext += "(Không có sản phẩm nào phù hợp ngân sách của khách hàng trong kho)\n\n";
      }

      if (maxPrice && upsellProducts.length > 0) {
        productContext += "\nDANH SÁCH SẢN PHẨM VƯỢT NGÂN SÁCH MỘT CHÚT (Có thể giới thiệu thêm để khách hàng tham khảo nâng cấp): \n";
        upsellProducts.forEach((p, idx) => {
          const displayPrice = formatPriceVND(p.price);
          const originalPrice = p.discountPrice && p.discountPrice > 0 ? formatPriceVND(p.discountPrice) : null;
          
          let priceStr = displayPrice;
          if (originalPrice) {
            priceStr = `${displayPrice} (giảm từ ${originalPrice})`;
          }
          
          productContext += `- [${p.name}](/product/${p.slug}): ${priceStr} - CPU ${p.specs.cpu || "N/A"}, RAM ${p.specs.ram || "N/A"}, SSD ${p.specs.storage || "N/A"}, VGA ${p.specs.vga || "N/A"}, Màn hình ${p.specs.screenSize || "N/A"}\n`;
        });
      }
    }


    // 4. Lấy lịch sử hội thoại gần nhất (Memory) để duy trì ngữ cảnh chat
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
    ];

    if (!isRAGSkipped && matchedProducts.length === 0) {
      apiMessages.push({
        role: "system",
        content: `⚠️ [CẢNH BÁO TỐI CAO]: Trong kho của TechStore hiện tại hoàn toàn KHÔNG CÓ sản phẩm nào khớp với yêu cầu "${messageText}" của khách hàng. Bạn tuyệt đối KHÔNG ĐƯỢC tự tạo, tự chế hoặc tự bịa ra bất kỳ sản phẩm/linh kiện nào. Hãy trả lời lịch sự rằng cửa hàng hiện không có hoặc tạm hết mặt hàng này, sau đó gợi ý khách tham khảo các danh mục/sản phẩm có sẵn trong danh sách kho phía trên.`
      });
    }

    apiMessages.push({ role: "user", content: messageText });

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
        max_tokens: settings.chatbotConfig.maxTokens || 500,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const replyText = response.data.choices[0].message.content;

    // Hậu xử lý (Post-processing) chống Hallucination
    const linkRegex = /\/product\/([a-zA-Z0-9_\-]+)/g;
    const linkMatches = [...replyText.matchAll(linkRegex)];
    
    if (linkMatches.length > 0) {
      const allDbProducts = await Product.find({ isActive: true }).select("slug").lean();
      const dbSlugs = new Set(allDbProducts.map(p => p.slug));
      
      let hasFakeLinks = false;
      for (const match of linkMatches) {
        const slug = match[1];
        if (!dbSlugs.has(slug)) {
          hasFakeLinks = true;
          break;
        }
      }
      
      if (hasFakeLinks) {
        const queryClean = messageText.replace(/[?.]/g, "").trim();
        return {
          reply: `Xin lỗi bạn, hiện tại TechStore chưa có sản phẩm "${queryClean}" phù hợp trong kho hàng ạ. Bạn có muốn tham khảo các mẫu PC hoặc Laptop có sẵn cấu hình mạnh mẽ khác của bên mình không ạ?\n\nCảm ơn bạn đã quan tâm đến sản phẩm của TechStore!`,
          suggestedProducts: []
        };
      }
    }

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
