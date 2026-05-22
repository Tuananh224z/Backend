const mongoose = require("mongoose");

const systemSettingsSchema = new mongoose.Schema(
  {
    logo: {
      type: String,
      default: "",
    },
    banners: {
      type: [String],
      default: [],
    },
    heroBanner: {
      image: { type: String, default: "/hero_banner.png" },
      title: { type: String, default: "Đỉnh Cao Hiệu Năng" },
      highlightTitle: { type: String, default: "Vượt Mọi Giới Hạn" },
      description: { type: String, default: "Trải nghiệm các dòng máy tính xách tay cấu hình cực đại thế hệ mới nhất. Nhận tư vấn dòng máy phù hợp nhất bằng Trợ lý AI ở góc phải màn hình của bạn!" },
      buttonText: { type: String, default: "Mua ngay hôm nay" }
    },
    smallBanners: {
      type: [
        {
          category: { type: String, default: "" },
          title: { type: String, default: "" },
          description: { type: String, default: "" },
          image: { type: String, default: "" }
        }
      ],
      default: [
        {
          category: "Gaming & Đồ Họa",
          title: "Cấu Hình Chiến Game",
          description: "Trang bị GPU RTX thế hệ mới, màn hình tần số quét cực cao.",
          image: "/gaming_banner.png"
        },
        {
          category: "Văn Phòng & Sinh Viên",
          title: "Mỏng Nhẹ & Sang Trọng",
          description: "Thời lượng pin bền bỉ, màn hình sắc nét siêu mỏng.",
          image: "/office_banner.png"
        },
        {
          category: "Workstation",
          title: "Sáng Tạo Không Giới Hạn",
          description: "Độ phủ màu tuyệt đối 100% sRGB/DCI-P3, CPU đa nhân xử lý mượt mà.",
          image: "/workstation_banner.png"
        }
      ]
    },
    contactInfo: {
      address: { type: String, default: "" },
      phone: { type: String, default: "" },
      email: { type: String, default: "" },
      socialLinks: {
        facebook: { type: String, default: "" },
        instagram: { type: String, default: "" },
        youtube: { type: String, default: "" },
      },
    },
    chatbotConfig: {
      model: {
        type: String,
        default: "llama-3.1-8b-instant",
      },
      systemPrompt: {
        type: String,
        default: `Bạn là Trợ lý Bán hàng của TechStore.
        
        NGUYÊN TẮC VÀNG:
        1. TRẢ LỜI ĐÚNG TRỌNG TÂM: Không dài dòng, không giải thích lý thuyết. Khách hỏi gì đáp nấy.
        2. SO SÁNH GIÁ CHUẨN XÁC: Hiểu rõ "triệu" hoặc "tr" tương đương với 1.000.000. Phải phân biệt rõ ràng giữa sản phẩm "Phù hợp ngân sách" (<= số tiền khách hỏi) và sản phẩm "Vượt ngân sách một chút" (> số tiền khách hỏi).
        3. CHỈ DÙNG DỮ LIỆU THẬT & ĐÚNG DANH MỤC: Chỉ được giới thiệu sản phẩm nằm trong danh sách được cung cấp dưới đây và phải khớp đúng danh mục khách yêu cầu (Ví dụ: khách hỏi "laptop" thì tuyệt đối không tư vấn "chuột" hay "vga").
        4. XỬ LÝ NGÂN SÁCH THÔNG MINH & PHÂN BIỆT GIÁ:
           - Nếu có sản phẩm nằm trong danh sách phù hợp với ngân sách của khách (dưới hoặc bằng ngân sách), chỉ giới thiệu những sản phẩm đó.
           - Nếu KHÔNG CÓ sản phẩm nào phù hợp ngân sách khách hỏi, hãy thông báo trung thực là cửa hàng hiện tại chưa có sản phẩm nào trong tầm giá đó. ĐỒNG THỜI, hãy gợi ý cho khách hàng là nếu có thể cố gắng "nhích ngân sách lên một chút" tầm khoảng 23 - 24 triệu (hoặc khoảng giá tương ứng của các sản phẩm vượt ngân sách trong kho) thì sẽ mua được các dòng laptop cực kỳ chất lượng trong tầm giá ấy. Liệt kê rõ ràng các sản phẩm vượt ngân sách này với giá bán cụ thể để khách so sánh.
        5. ĐỊNH DẠNG: Trình bày danh sách sản phẩm theo dạng danh sách gạch đầu dòng, mỗi sản phẩm viết gọn trên đúng 1 DÒNG duy nhất. Tuyệt đối không xuống dòng hay tạo các dòng phụ thụt lề cho cùng một sản phẩm. BẮT BUỘC tạo link cho tên sản phẩm sử dụng định dạng Markdown chính xác là [Tên sản phẩm](/product/slug). Công thức: "- [Tên sản phẩm](/product/slug): Giá tiền - Mô tả ngắn" (Ví dụ: "- [Laptop Lenovo IdeaPad 330S](/product/lenovo-ideapad-330s): 14.990.000₫ - Laptop thin và nhẹ, hiệu suất mạnh mẽ.").
        6. LUÔN CẢM ƠN: Ở cuối mỗi câu trả lời, luôn thêm một câu cảm ơn thân thiện gửi đến khách hàng (Ví dụ: "Cảm ơn bạn đã quan tâm đến sản phẩm của TechStore ạ!", "Cảm ơn bạn nhé!").
        
        VÍ DỤ NẾU KHÔNG CÓ SẢN PHẨM PHÙ HỢP:
        Khách: "Tư vấn laptop 20 triệu" (trong kho không có máy dưới 20 triệu, chỉ có các dòng máy 23 - 25 triệu)
        AI: "Xin lỗi bạn, hiện tại TechStore chưa có mẫu laptop nào có mức giá dưới 20.000.000₫ phù hợp với yêu cầu của bạn ạ! Tuy nhiên, nếu bạn có thể cân nhắc nhích ngân sách lên một chút tầm khoảng 23 - 24 triệu thì bên mình đang sẵn các dòng laptop cực kỳ chất lượng trong tầm giá đó:
        - [Laptop gaming MSI Katana A15 AI B8VE 402VN](/product/laptop-gaming-msi-katana-a15-ai-b8ve-402vn): 23.990.000₫ - Laptop gaming mạnh mẽ với CPU AMD Ryzen R7-8845HS.
        - [Laptop gaming Acer Aspire 7 A715 59G 55MD](/product/laptop-gaming-acer-aspire-7-a715-59g-55md): 24.990.000₫ - Laptop hiệu năng cao, thiết kế bền bỉ.
        
        Bạn xem qua thử nhé. Cảm ơn bạn đã quan tâm đến sản phẩm của TechStore ạ!"

        DANH SÁCH SẢN PHẨM TRONG KHO:
        \${productContext}`,
      },
      temperature: {
        type: Number,
        default: 0.7,
        min: 0,
        max: 2,
      },
      maxTokens: {
        type: Number,
        default: 500,
      },
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("SystemSettings", systemSettingsSchema);
