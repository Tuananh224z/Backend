const SystemSettings = require("../../models/systemSettings");

const initSystemSettings = async () => {
  try {
    const defaultPrompt = `Bạn là Trợ lý Bán hàng của TechStore.
        
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
        \${productContext}`;

    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = await SystemSettings.create({
        logo: "",
        banners: [],
        contactInfo: {
          address: "123 Đường Laptop, Hà Nội",
          phone: "0123456789",
          email: "contact@laptopshop.com",
        },
        chatbotConfig: {
          model: "llama-3.1-8b-instant",
          systemPrompt: defaultPrompt,
          temperature: 0.7,
          maxTokens: 500,
        },
      });
      console.log(">> Đã khởi tạo cấu hình hệ thống mặc định thành công.");
    } else {
      // Cập nhật cấu hình chatbot với Prompt và Model mới nếu chưa khớp
      let isUpdated = false;
      
      if (!settings.chatbotConfig) {
        settings.chatbotConfig = {
          model: "llama-3.1-8b-instant",
          systemPrompt: defaultPrompt,
          temperature: 0.7,
          maxTokens: 500,
        };
        isUpdated = true;
      } else {
        if (!settings.chatbotConfig.model || settings.chatbotConfig.model === "llama3-8b-8192") {
          settings.chatbotConfig.model = "llama-3.1-8b-instant";
          isUpdated = true;
        }
        
        // Cập nhật prompt sang Nguyên Tắc Vàng của người dùng
        if (
          !settings.chatbotConfig.systemPrompt ||
          !settings.chatbotConfig.systemPrompt.includes("NGUYÊN TẮC VÀNG")
        ) {
          settings.chatbotConfig.systemPrompt = defaultPrompt;
          isUpdated = true;
        }
      }

      if (isUpdated) {
        await SystemSettings.findByIdAndUpdate(settings._id, {
          $set: { chatbotConfig: settings.chatbotConfig },
        });
        console.log(">> Đã cập nhật cấu hình chatbot hệ thống theo Nguyên Tắc Vàng mới.");
      }
    }
  } catch (error) {
    console.error("Lỗi khi khởi tạo cấu hình hệ thống:", error.message);
  }
};

module.exports = initSystemSettings;
