const Order = require('../../models/order');
const axios = require('axios');

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

  const bankId = process.env.SHOP_BANK_ID || '970422';
  const accountNo = process.env.SHOP_BANK_ACCOUNT || '0342055095';
  const accountName = process.env.SHOP_BANK_NAME || 'CAO XUAN TUAN ANH';
  const amount = order.totalAmount;

  // Rút gọn mã đơn hàng viết liền (ví dụ: ORD149660091107)
  const cleanOrderCode = order.orderCode.replace(/-/g, '');

  // Lấy 6 ký tự cuối của ID người dùng viết hoa
  const shortUserId = userId.toString().slice(-6).toUpperCase();

  // Tính tổng số lượng sản phẩm trong đơn hàng
  const totalQty = order.items.reduce((sum, item) => sum + (item.quantity || 0), 0);

  // Lấy thời gian tạo đơn hàng định dạng HHMM
  const orderDate = new Date(order.createdAt || Date.now());
  const hh = String(orderDate.getHours()).padStart(2, '0');
  const mm = String(orderDate.getMinutes()).padStart(2, '0');
  const timeStr = `${hh}${mm}`;

  // Tạo nội dung chuyển khoản động, ngắn gọn
  const addInfo = `${cleanOrderCode} U${shortUserId} Q${totalQty} T${timeStr}`;

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

    // Tìm mã đơn hàng có dạng ORDxxxxxxxxxxxx (12 số đi sau ORD) và chuyển đổi thành dạng chuẩn ORD-xxxxxxxx-xxxx
    const match = cleanDesc.match(/(ORD)(\d{8})(\d{4})/i);
    if (match) {
      const orderCode = `ORD-${match[2]}-${match[3]}`.toUpperCase();

      // Tìm đơn hàng trong cơ sở dữ liệu
      const order = await Order.findOne({ orderCode });
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

  const apiKey = process.env.CASSO_API_KEY;
  if (!apiKey) {
    return { success: false, message: 'No API Key found' };
  }

  try {
    const response = await axios.get('https://oauth.casso.vn/v2/transactions', {
      headers: {
        'Authorization': `Apikey ${apiKey}`
      },
      params: {
        pageSize: 20,
        sort: 'DESC'
      }
    });

    if (response.data && response.data.data) {
      const dataPayload = response.data.data;
      const transactions = Array.isArray(dataPayload) ? dataPayload : (dataPayload.records || []);

      let matchedCount = 0;
      for (const transaction of transactions) {
        const { description, amount, tid, when } = transaction;
        const cleanDesc = (description || '').replace(/[\s-]/g, '');
        const match = cleanDesc.match(/(ORD)(\d{8})(\d{4})/i);

        if (match) {
          const orderCode = `ORD-${match[2]}-${match[3]}`.toUpperCase();
          const order = await Order.findOne({ orderCode });

          if (order && order.paymentStatus !== 'Paid') {
            if (amount >= order.totalAmount) {
              order.paymentStatus = 'Paid';
              order.orderStatus = 'Confirmed';
              order.paymentDetails = {
                gateway: 'CassoAPI',
                transactionId: tid,
                amountReceived: amount,
                paymentDate: when,
                rawDescription: description
              };
              await order.save();
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
