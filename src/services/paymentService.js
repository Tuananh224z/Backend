const Order = require('../models/order');
const axios = require('axios');
const emailService = require('./emailService');

/**
 * Lấy thông tin thanh toán QR cho đơn hàng của người dùng
 * @param {string} orderId
 * @param {string} userId
 */
const getQRPaymentInfo = async (orderId, userId) => {
  const order = await Order.findOne({ _id: orderId, user: userId });
  if (!order) {
    throw new Error('Không tìm thấy đơn hàng hoặc bạn không có quyền sở hữu đơn hàng này');
  }

  const bankId = process.env.SHOP_BANK_ID || 'OCB';
  const accountNo = process.env.SHOP_BANK_ACCOUNT || '0342055095';
  const accountName = process.env.SHOP_BANK_NAME || 'CAO XUAN TUAN ANH';
  const amount = order.totalAmount;

  // Tạo nội dung chuyển khoản động cực kỳ ngắn gọn dạng TS-DDMMHHMMXX (ví dụ: TS-2605102306)
  const addInfo = order.orderCode;

  // Tạo URL mã QR động từ VietQR sử dụng template compact (Napas 247 + Logo ngân hàng)
  const qrCodeUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact.png?amount=${amount}&addInfo=${encodeURIComponent(addInfo)}&accountName=${encodeURIComponent(accountName)}`;

  return {
    orderId: order._id,
    orderCode: order.orderCode,
    totalAmount: order.totalAmount,
    bankId,
    accountNo,
    accountName,
    qrCodeUrl,
    addInfo
  };
};

/**
 * Xử lý webhook Casso
 * @param {object} headers
 * @param {object} body
 */
const processCassoWebhook = async (headers, body) => {
  // 1. Kiểm tra Secure Token để đảm bảo request gửi từ Casso
  const secureToken = headers['secure-token'];
  const expectedToken = process.env.CASSO_SECURE_TOKEN || 'casso_secure_token_techstore_2026';

  if (!secureToken || secureToken !== expectedToken) {
    const error = new Error('Unauthorized: Secure token is invalid');
    error.statusCode = 401;
    throw error;
  }

  const { data } = body;
  if (!data || !Array.isArray(data)) {
    const error = new Error('Invalid payload: data array is required');
    error.statusCode = 400;
    throw error;
  }

  // Duyệt qua từng giao dịch ngân hàng do Casso gửi sang
  for (const transaction of data) {
    const { description, amount, tid, when } = transaction;

    // Loại bỏ dấu gạch ngang và khoảng trắng để chuẩn hóa chuỗi mô tả chuyển khoản
    const cleanDesc = (description || '').replace(/[\s-]/g, '');

    // Tìm mã đơn hàng có dạng TSxxxxxxxxxx (10 số đi sau TS) và chuyển đổi thành dạng chuẩn TS-xxxxxxxxxx
    const match = cleanDesc.match(/(TS)(\d{10})/i);
    if (match) {
      const orderCode = `TS-${match[2]}`.toUpperCase();

      // Tìm đơn hàng trong cơ sở dữ liệu
      const order = await Order.findOne({ orderCode }).populate('user');
      if (order && order.paymentStatus !== 'Paid') {
        // Đối chiếu số tiền chuyển khoản xem có đủ để thanh toán cho đơn hàng không
        if (amount >= order.totalAmount) {
          order.paymentStatus = 'Paid';
          order.orderStatus = 'Confirmed'; // Cập nhật trạng thái đơn hàng sang Đã xác nhận
          order.paymentDetails = {
            gateway: 'Casso',
            transactionId: tid,
            amountReceived: amount,
            paymentDate: when,
            rawDescription: description
          };
          await order.save();
          
          // Gửi email xác nhận thanh toán (không chặn luồng webhook)
          emailService.sendPaymentSuccessEmail(order).catch(err => {
            console.error('Lỗi khi gửi email xác nhận thanh toán (Casso):', err);
          });
        }
      }
    }
  }

  return { success: true };
};

let lastSyncTime = 0;
const SYNC_COOLDOWN = 10000; // 10s cooldown to avoid spamming the Casso API

const syncCassoTransactions = async () => {
  const now = Date.now();
  const elapsed = now - lastSyncTime;
  if (elapsed < SYNC_COOLDOWN) {
    return { success: true, message: 'Cooldown active' };
  }

  const sheetUrl = process.env.GOOGLE_SHEET_URL;
  if (!sheetUrl) {
    return { success: false, message: 'No Google Sheet URL found' };
  }

  try {
    const response = await axios.get(sheetUrl);

    if (response.data && response.data.data) {
      const transactions = response.data.data;

      let matchedCount = 0;
      for (const transaction of transactions) {
        // Ánh xạ dữ liệu cột tiếng Việt từ Google Sheet trả về qua doGet
        const description = transaction["Mô tả"] || "";
        const amount = parseFloat(transaction["Giá trị"]) || 0;
        const tid = transaction["Mã GD"] || "";
        const when = transaction["Ngày diễn ra"] || "";

        const cleanDesc = (description || '').replace(/[\s-]/g, '');
        const match = cleanDesc.match(/(TS)(\d{10})/i);

        if (match) {
          const orderCode = `TS-${match[2]}`.toUpperCase();
          const order = await Order.findOne({ orderCode }).populate('user');

          if (order && order.paymentStatus !== 'Paid') {
            if (amount >= order.totalAmount) {
              order.paymentStatus = 'Paid';
              order.orderStatus = 'Confirmed';
              order.paymentDetails = {
                gateway: 'GoogleSheet',
                transactionId: tid,
                amountReceived: amount,
                paymentDate: when,
                rawDescription: description
              };
              await order.save();
              
              // Gửi email xác nhận thanh toán (không chặn luồng đồng bộ)
              emailService.sendPaymentSuccessEmail(order).catch(err => {
                console.error('Lỗi khi gửi email xác nhận thanh toán (GoogleSheet):', err);
              });
              
              matchedCount++;
            }
          }
        }
      }

      lastSyncTime = now;
      return { success: true, matchedCount };
    } else {
      return { success: false, message: 'Invalid API response structure' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
};

module.exports = {
  getQRPaymentInfo,
  processCassoWebhook,
  syncCassoTransactions
};
