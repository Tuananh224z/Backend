const nodemailer = require('nodemailer');

// Khởi tạo transporter cấu hình SMTP từ biến môi trường
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT) || 465,
  secure: parseInt(process.env.EMAIL_PORT) === 465, // true nếu port 465, false nếu port khác (như 587)
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Định dạng tiền tệ VND
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

// Định dạng thời gian
const formatDate = (dateStr) => {
  if (!dateStr) return new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? dateStr : date.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
};

/**
 * Gửi email xác nhận thanh toán thành công cho khách hàng
 * @param {object} order Đơn hàng đã được populate thông tin user
 */
const sendPaymentSuccessEmail = async (order) => {
  try {
    if (!order || !order.user || !order.user.email) {
      console.warn('[EmailService] Không thể gửi email: Thiếu thông tin người dùng hoặc email.');
      return;
    }

    const customerEmail = order.user.email;
    const customerName = order.user.fullName || 'Quý khách';
    const orderCode = order.orderCode;
    const paymentDate = formatDate(order.paymentDetails?.paymentDate);
    
    // Tính tạm tính
    const subtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Tạo danh sách sản phẩm dưới dạng bảng HTML
    const itemsTableRows = order.items.map(item => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #edf2f7; text-align: left; color: #4a5568;">
          <span style="font-weight: 600; color: #2d3748;">${item.name}</span>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #edf2f7; text-align: center; color: #4a5568;">
          ${item.quantity}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #edf2f7; text-align: right; color: #4a5568;">
          ${formatCurrency(item.price)}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #edf2f7; text-align: right; font-weight: 600; color: #2d3748;">
          ${formatCurrency(item.price * item.quantity)}
        </td>
      </tr>
    `).join('');

    const address = order.shippingAddress;
    const fullAddressText = [
      address.street,
      address.ward,
      address.district,
      address.city
    ].filter(Boolean).join(', ');

    // Giao diện HTML cao cấp cho email
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Xác nhận thanh toán thành công - TechStore</title>
      </head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f7fafc; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
        <div style="max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
          
          <!-- Header Accent Gradient -->
          <div style="background: linear-gradient(135deg, #1a365d 0%, #2b6cb0 100%); padding: 35px 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">
              Thanh Toán Thành Công
            </h1>
            <p style="color: #ebf8ff; margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">
              Cảm ơn bạn đã mua sắm tại TechStore
            </p>
          </div>

          <div style="padding: 30px 25px;">
            
            <p style="font-size: 16px; color: #2d3748; line-height: 1.6; margin-top: 0;">
              Chào <strong>${customerName}</strong>,
            </p>
            <p style="font-size: 15px; color: #4a5568; line-height: 1.6; margin-bottom: 25px;">
              TechStore xin thông báo đã nhận được thanh toán chuyển khoản cho đơn hàng <strong>${orderCode}</strong> của bạn. Đơn hàng đang được chuyển sang bộ phận chuẩn bị hàng để gửi tới bạn trong thời gian sớm nhất.
            </p>

            <!-- Grid thông tin thanh toán -->
            <div style="background-color: #ebf8ff; border-left: 4px solid #3182ce; padding: 15px; border-radius: 0 8px 8px 0; margin-bottom: 25px;">
              <h3 style="margin: 0 0 10px 0; color: #2b6cb0; font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Thông tin giao dịch</h3>
              <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
                <tr>
                  <td style="padding: 4px 0; color: #4a5568; font-weight: 600; width: 140px;">Mã đơn hàng:</td>
                  <td style="padding: 4px 0; color: #2d3748; font-weight: 700;">${orderCode}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #4a5568; font-weight: 600;">Thời gian:</td>
                  <td style="padding: 4px 0; color: #2d3748;">${paymentDate}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #4a5568; font-weight: 600;">Cổng thanh toán:</td>
                  <td style="padding: 4px 0; color: #2d3748;">Chuyển khoản ngân hàng (${order.paymentDetails?.gateway || 'Online'})</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #4a5568; font-weight: 600;">Mã giao dịch:</td>
                  <td style="padding: 4px 0; color: #2d3748; font-family: monospace; font-weight: 600;">${order.paymentDetails?.transactionId || 'N/A'}</td>
                </tr>
              </table>
            </div>

            <!-- Bảng sản phẩm -->
            <h3 style="color: #2d3748; font-size: 16px; margin: 0 0 12px 0; font-weight: 700; border-bottom: 2px solid #edf2f7; padding-bottom: 8px;">Chi tiết đơn hàng</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 14px;">
              <thead>
                <tr style="background-color: #f7fafc;">
                  <th style="padding: 10px 12px; text-align: left; font-weight: 700; color: #4a5568; border-bottom: 2px solid #e2e8f0;">Sản phẩm</th>
                  <th style="padding: 10px 12px; text-align: center; font-weight: 700; color: #4a5568; border-bottom: 2px solid #e2e8f0; width: 60px;">SL</th>
                  <th style="padding: 10px 12px; text-align: right; font-weight: 700; color: #4a5568; border-bottom: 2px solid #e2e8f0; width: 100px;">Đơn giá</th>
                  <th style="padding: 10px 12px; text-align: right; font-weight: 700; color: #4a5568; border-bottom: 2px solid #e2e8f0; width: 110px;">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                ${itemsTableRows}
              </tbody>
            </table>

            <!-- Tổng cộng tiền -->
            <div style="width: 60%; margin-left: 40%; margin-bottom: 30px; font-size: 14px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 6px 0; color: #718096; text-align: left;">Tạm tính:</td>
                  <td style="padding: 6px 0; color: #4a5568; text-align: right;">${formatCurrency(subtotal)}</td>
                </tr>
                ${order.discountAmount ? `
                <tr>
                  <td style="padding: 6px 0; color: #e53e3e; text-align: left;">Giảm giá:</td>
                  <td style="padding: 6px 0; color: #e53e3e; text-align: right;">-${formatCurrency(order.discountAmount)}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 6px 0; color: #718096; text-align: left;">Phí vận chuyển:</td>
                  <td style="padding: 6px 0; color: #4a5568; text-align: right;">${order.shippingFee ? formatCurrency(order.shippingFee) : 'Miễn phí'}</td>
                </tr>
                <tr style="border-top: 1px solid #e2e8f0;">
                  <td style="padding: 12px 0 0 0; color: #2d3748; font-weight: 700; font-size: 16px; text-align: left;">Tổng thanh toán:</td>
                  <td style="padding: 12px 0 0 0; color: #2b6cb0; font-weight: 700; font-size: 18px; text-align: right;">${formatCurrency(order.totalAmount)}</td>
                </tr>
              </table>
            </div>

            <!-- Thông tin giao hàng -->
            <div style="background-color: #f7fafc; border: 1px solid #edf2f7; padding: 20px; border-radius: 8px; margin-bottom: 10px;">
              <h3 style="margin: 0 0 12px 0; color: #2d3748; font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Địa chỉ nhận hàng</h3>
              <table style="width: 100%; font-size: 14px; border-collapse: collapse; line-height: 1.6;">
                <tr>
                  <td style="padding: 3px 0; color: #718096; width: 100px; vertical-align: top;">Người nhận:</td>
                  <td style="padding: 3px 0; color: #2d3748; font-weight: 600;">${address.fullName}</td>
                </tr>
                <tr>
                  <td style="padding: 3px 0; color: #718096; vertical-align: top;">Số điện thoại:</td>
                  <td style="padding: 3px 0; color: #2d3748;">${address.phone}</td>
                </tr>
                <tr>
                  <td style="padding: 3px 0; color: #718096; vertical-align: top;">Địa chỉ:</td>
                  <td style="padding: 3px 0; color: #2d3748;">${fullAddressText}</td>
                </tr>
              </table>
            </div>

          </div>

          <!-- Footer -->
          <div style="background-color: #f7fafc; border-top: 1px solid #edf2f7; padding: 20px; text-align: center; font-size: 12px; color: #a0aec0; line-height: 1.5;">
            <p style="margin: 0 0 8px 0;">Đây là email tự động từ hệ thống TechStore, vui lòng không trả lời trực tiếp email này.</p>
            <p style="margin: 0;">Nếu cần hỗ trợ gấp, vui lòng liên hệ hotline <strong>034 205 5095</strong> hoặc email <strong>support@techstore.vn</strong>.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Cấu hình thông tin email gửi đi
    const mailOptions = {
      from: process.env.EMAIL_FROM || `"TechStore" <${process.env.EMAIL_USER}>`,
      to: customerEmail,
      subject: `[TechStore] Xác nhận thanh toán thành công đơn hàng #${orderCode}`,
      html: htmlContent
    };

    console.log(`[EmailService] Bắt đầu gửi email xác nhận thanh toán đơn hàng #${orderCode} tới ${customerEmail}...`);
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EmailService] Email đã gửi thành công! MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[EmailService] Gặp lỗi nghiêm trọng khi gửi email:', error);
    // Trả về false hoặc error nhưng không ném ra ngoài để tránh crash flow chính
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendPaymentSuccessEmail
};
