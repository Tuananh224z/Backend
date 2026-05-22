const Order = require('../../models/order');
const fs = require('fs');
const path = require('path');

const logDebug = (message) => {
  const logPath = path.resolve(__dirname, '../../casso_sync_debug.log');
  const timestamp = new Date().toISOString();
  console.log(message);
  try {
    fs.appendFileSync(logPath, `[${timestamp}] ${message}\n`, 'utf8');
  } catch (err) {
    console.error('Lỗi khi ghi log file:', err);
  }
};

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
  logDebug('=== CASSO WEBHOOK RECIEVED ===');
  // 1. Kiểm tra Secure Token để đảm bảo request gửi từ Casso
  const secureToken = headers['secure-token'];
  const expectedToken = process.env.CASSO_SECURE_TOKEN || 'casso_secure_token_techstore_2026';
  
  logDebug(`Secure token received: "${secureToken}". Expected token: "${expectedToken}"`);
  if (!secureToken || secureToken !== expectedToken) {
    logDebug('Cảnh báo bảo mật: Nhận Webhook Casso nhưng secure-token không đúng!');
    const error = new Error('Unauthorized: Secure token is invalid');
    error.statusCode = 401;
    throw error;
  }

  const { data } = body;
  if (!data || !Array.isArray(data)) {
    logDebug('Casso webhook payload không chứa mảng data!');
    const error = new Error('Invalid payload: data array is required');
    error.statusCode = 400;
    throw error;
  }

  logDebug(`Mảng data chứa ${data.length} giao dịch chuyển khoản mới`);
  
  // Duyệt qua từng giao dịch ngân hàng do Casso gửi sang
  for (const transaction of data) {
    const { description, amount, tid, when } = transaction;
    logDebug(`- Giao dịch ID: ${tid}`);
    logDebug(`  Số tiền: ${amount.toLocaleString('vi-VN')}đ`);
    logDebug(`  Nội dung chuyển khoản (Raw): "${description}"`);
    logDebug(`  Thời gian: ${when}`);

    // Loại bỏ dấu gạch ngang và khoảng trắng để chuẩn hóa chuỗi mô tả chuyển khoản
    const cleanDesc = (description || '').replace(/[\s-]/g, '');
    logDebug(`  Nội dung chuyển khoản đã làm sạch: "${cleanDesc}"`);
    
    // Tìm mã đơn hàng có dạng ORDxxxxxxxxxxxx (12 số đi sau ORD) và chuyển đổi thành dạng chuẩn ORD-xxxxxxxx-xxxx
    const match = cleanDesc.match(/(ORD)(\d{8})(\d{4})/i);
    if (match) {
      const orderCode = `ORD-${match[2]}-${match[3]}`.toUpperCase();
      logDebug(`  => Phát hiện nội dung chuyển khoản khớp với mã đơn hàng: ${orderCode}`);

      // Tìm đơn hàng trong cơ sở dữ liệu
      const order = await Order.findOne({ orderCode });
      if (order) {
        logDebug(`  [Tìm thấy Đơn Hàng] ID: ${order._id}, Trạng thái thanh toán hiện tại: "${order.paymentStatus}", Tổng tiền cần thanh toán: ${order.totalAmount}đ`);
        // Kiểm tra nếu đơn hàng chưa được thanh toán thành công
        if (order.paymentStatus !== 'Paid') {
          // Đối chiếu số tiền chuyển khoản xem có đủ để thanh toán cho đơn hàng không
          logDebug(`  Đối chiếu số tiền: Nhận được ${amount}đ vs Cần thanh toán ${order.totalAmount}đ`);
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
            logDebug(`  [THÀNH CÔNG] Đơn hàng ${orderCode} đã được tự động duyệt thanh toán qua Casso!`);
          } else {
            logDebug(`  [THẤT BẠI] Số tiền chuyển khoản (${amount}đ) nhỏ hơn tổng giá trị đơn hàng (${order.totalAmount}đ)!`);
          }
        } else {
          logDebug(`  => Đơn hàng ${orderCode} đã có trạng thái thanh toán là 'Paid' từ trước.`);
        }
      } else {
        logDebug(`  => Không tìm thấy đơn hàng trong hệ thống khớp với mã: ${orderCode}`);
      }
    } else {
      logDebug('  => Nội dung chuyển khoản không chứa mã đơn hàng ORD-xxxxxxxx-xxxx hợp lệ.');
    }
  }

  return { success: true };
};

const axios = require('axios');

let lastSyncTime = 0;
const SYNC_COOLDOWN = 10000; // 10s cooldown to avoid spamming the Casso API

const syncCassoTransactions = async () => {
  const now = Date.now();
  const elapsed = now - lastSyncTime;
  logDebug(`=== CASSO AUTO-SYNC CALLED === (Đã trôi qua: ${Math.round(elapsed / 1000)}s từ lần sync trước)`);
  if (elapsed < SYNC_COOLDOWN) {
    logDebug(`[CASSO SYNC] Đang trong thời gian chờ (cooldown 10s còn lại ${Math.round((SYNC_COOLDOWN - elapsed)/1000)}s). Bỏ qua để tránh spam.`);
    return { success: true, message: 'Cooldown active' };
  }
  
  const apiKey = process.env.CASSO_API_KEY;
  if (!apiKey) {
    logDebug('[CASSO SYNC] CẢNH BÁO: Không tìm thấy CASSO_API_KEY trong file .env');
    return { success: false, message: 'No API Key found' };
  }

  // Mask API key để bảo mật log
  const maskedKey = apiKey.length > 15 
    ? `${apiKey.slice(0, 8)}...${apiKey.slice(-8)}` 
    : '***';
  logDebug(`Sử dụng Casso API Key: ${maskedKey}`);

  try {
    logDebug('[CASSO SYNC] Bắt đầu gửi GET request tới https://oauth.casso.vn/v2/transactions...');
    const response = await axios.get('https://oauth.casso.vn/v2/transactions', {
      headers: {
        'Authorization': `Apikey ${apiKey}`
      },
      params: {
        pageSize: 20,
        sort: 'DESC'
      }
    });

    logDebug(`[CASSO SYNC] Response status: ${response.status}`);

    if (response.data && response.data.data) {
      const dataPayload = response.data.data;
      const transactions = Array.isArray(dataPayload) ? dataPayload : (dataPayload.records || []);
      logDebug(`[CASSO SYNC] Lấy thành công ${transactions.length} giao dịch gần nhất từ Casso`);
      
      let matchedCount = 0;
      for (const transaction of transactions) {
        const { description, amount, tid, when } = transaction;
        logDebug(`- Sync GD: ID=${tid}, Tiền=${amount}đ, ND="${description}", Lúc=${when}`);

        const cleanDesc = (description || '').replace(/[\s-]/g, '');
        const match = cleanDesc.match(/(ORD)(\d{8})(\d{4})/i);
        
        if (match) {
          const orderCode = `ORD-${match[2]}-${match[3]}`.toUpperCase();
          logDebug(`  => Khớp mã đơn hàng: ${orderCode}`);
          const order = await Order.findOne({ orderCode });
          
          if (order) {
            logDebug(`  [Tìm thấy Đơn Hàng] ID: ${order._id}, Trạng thái: "${order.paymentStatus}", Cần: ${order.totalAmount}đ`);
            if (order.paymentStatus !== 'Paid') {
              logDebug(`  So khớp số tiền: GD=${amount}đ vs Cần=${order.totalAmount}đ`);
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
                logDebug(`  [CASSO SYNC THÀNH CÔNG] Đơn hàng ${orderCode} đã được cập nhật thành công thành 'Paid'!`);
              } else {
                logDebug(`  [CASSO SYNC THẤT BẠI] Số tiền chuyển khoản (${amount}đ) nhỏ hơn tổng đơn (${order.totalAmount}đ)!`);
              }
            } else {
              logDebug(`  => Đơn hàng ${orderCode} đã được thanh toán từ trước.`);
            }
          } else {
            logDebug(`  => Không tìm thấy đơn hàng ${orderCode} trong cơ sở dữ liệu.`);
          }
        } else {
          logDebug(`  => Nội dung chuyển khoản "${description}" không chứa mã đơn hàng hợp lệ.`);
        }
      }
      
      lastSyncTime = now;
      logDebug(`=== CASSO AUTO-SYNC COMPLETED === (Cập nhật thành công ${matchedCount} đơn hàng)`);
      return { success: true, matchedCount };
    } else {
      logDebug(`[CASSO SYNC] Phản hồi từ Casso API không có cấu trúc dữ liệu mong muốn: ${JSON.stringify(response.data)}`);
      return { success: false, message: 'Invalid API response structure' };
    }
  } catch (error) {
    const errorDetails = error.response 
      ? `HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}` 
      : error.message;
    logDebug(`[CASSO SYNC ERROR] Thất bại khi lấy dữ liệu: ${errorDetails}`);
    return { success: false, error: error.message };
  }
};

module.exports = {
  getQRPaymentInfo,
  processCassoWebhook,
  syncCassoTransactions
};
// Trigger reload after env key update
