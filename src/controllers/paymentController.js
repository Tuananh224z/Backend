const paymentService = require('../services/paymentService');

/**
 * Lấy thông tin thanh toán QR cho đơn hàng (Dành cho khách hàng)
 * GET /api/orders/:id/qr-payment
 */
const getQRPaymentInfo = async (req, res) => {
  try {
    const paymentData = await paymentService.getQRPaymentInfo(req.params.id, req.user._id);

    // Đảm bảo không lưu cache để luôn lấy thông tin mới nhất
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    return res.status(200).json({
      status: 'success',
      data: paymentData
    });
  } catch (error) {
    return res.status(400).json({
      status: 'fail',
      message: error.message
    });
  }
};

/**
 * Xử lý Webhook nhận thông báo giao dịch chuyển khoản từ Casso
 * POST /api/payment/casso-webhook
 */
const handleCassoWebhook = async (req, res) => {
  try {
    await paymentService.processCassoWebhook(req.headers, req.body);

    // Trả về phản hồi thành công (Casso yêu cầu trả về HTTP Status 200, trường error: 0)
    return res.status(200).json({
      error: 0,
      message: 'Casso Webhook processed successfully'
    });
  } catch (error) {
    console.error('Lỗi nghiêm trọng khi xử lý Casso Webhook:', error);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      error: 1,
      message: error.message
    });
  }
};

module.exports = {
  getQRPaymentInfo,
  handleCassoWebhook
};
