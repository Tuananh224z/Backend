const Order = require("../models/order");
const Cart = require("../models/cart");
const Product = require("../models/product");

/**
 * Helper to generate a unique order code.
 */
const generateOrderCode = () => {
  const date = new Date();
  const DD = String(date.getDate()).padStart(2, '0');
  const MM = String(date.getMonth() + 1).padStart(2, '0');
  const HH = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const random = Math.floor(10 + Math.random() * 90); // 2 số ngẫu nhiên
  return `TS-${DD}${MM}${HH}${mm}${random}`;
};

/**
 * Customer: Place a new order from their current cart.
 */
const createOrder = async (userId, orderData) => {
  const { shippingAddress, paymentMethod, notes, couponApplied, discountAmount = 0, items } = orderData;

  let itemsToProcess = [];
  let cartObj = null;

  if (items && items.length > 0) {
    itemsToProcess = items.map(item => ({
      product: item.product._id || item.product,
      quantity: item.quantity
    }));
  } else {
    // 1. Lấy giỏ hàng của người dùng từ database
    cartObj = await Cart.findOne({ user: userId });
    if (!cartObj || cartObj.items.length === 0) {
      throw new Error("Giỏ hàng của bạn đang trống");
    }
    itemsToProcess = cartObj.items;
  }

  const orderItems = [];
  let subtotal = 0;

  // 2. Kiểm tra tồn kho và chuẩn bị dữ liệu sản phẩm
  for (const item of itemsToProcess) {
    const productId = item.product ? (item.product._id || item.product).toString() : "";
    if (!productId.match(/^[0-9a-fA-F]{24}$/)) {
      throw new Error(`Mã sản phẩm "${productId}" không hợp lệ (yêu cầu định dạng ObjectId)`);
    }
    const product = await Product.findById(productId);
    if (!product) {
      throw new Error(`Sản phẩm với ID ${item.product} không còn tồn tại`);
    }
    if (!product.isActive) {
      throw new Error(`Sản phẩm "${product.name}" đã ngừng bán`);
    }
    if (product.stock < item.quantity) {
      throw new Error(`Sản phẩm "${product.name}" không đủ hàng trong kho. Còn lại: ${product.stock}`);
    }

    // Giá mua thực tế (lấy giá thường tại thời điểm mua)
    const finalPrice = product.price;

    orderItems.push({
      product: product._id,
      name: product.name,
      price: finalPrice,
      quantity: item.quantity,
    });

    subtotal += finalPrice * item.quantity;
  }

  // 3. Trừ số lượng tồn kho của các sản phẩm
  for (const item of itemsToProcess) {
    await Product.findByIdAndUpdate(item.product, {
      $inc: { stock: -item.quantity },
    });
  }

  // 4. Tính toán tổng tiền thanh toán
  const shippingFee = subtotal > 15000000 ? 0 : 50000; // Miễn phí ship đơn hàng trên 15 triệu
  const totalAmount = subtotal + shippingFee - discountAmount;

  // 5. Tạo mã đơn hàng độc nhất và lưu đơn hàng
  const orderCode = generateOrderCode();
  const newOrder = await Order.create({
    orderCode,
    user: userId,
    items: orderItems,
    shippingAddress,
    paymentMethod,
    paymentStatus: "Pending",
    orderStatus: "Pending",
    shippingFee,
    discountAmount,
    couponApplied,
    totalAmount: totalAmount < 0 ? 0 : totalAmount,
    notes,
  });

  // 6. Xóa giỏ hàng sau khi đặt hàng thành công
  if (cartObj) {
    cartObj.items = [];
    await cartObj.save();
  } else {
    // Xóa giỏ hàng DB nếu có
    await Cart.findOneAndUpdate({ user: userId }, { items: [] });
  }

  // Populate product details before returning
  await newOrder.populate("items.product", "images name slug specs");

  return newOrder;
};

/**
 * Customer: Get order history.
 */
const getCustomerOrders = async (userId) => {
  return await Order.find({ user: userId })
    .populate("items.product", "images name slug specs")
    .sort({ createdAt: -1 });
};

/**
 * Get order details (supports checking user ownership).
 */
const getOrderDetails = async (orderId, userId = null) => {
  const query = { _id: orderId };
  if (userId) query.user = userId;

  const order = await Order.findOne(query).populate("items.product", "images name slug specs");
  if (!order) {
    throw new Error("Không tìm thấy đơn hàng");
  }
  return order;
};

/**
 * Customer: Cancel order (only if status is Pending).
 */
const cancelOrder = async (orderId, userId, reason) => {
  const order = await Order.findOne({ _id: orderId, user: userId });
  
  if (!order) {
    throw new Error("Không tìm thấy đơn hàng");
  }

  if (order.orderStatus !== "Pending") {
    throw new Error("Chỉ có thể hủy đơn hàng khi trạng thái là 'Pending' (Đang xử lý)");
  }

  // Cập nhật trạng thái đơn hàng
  order.orderStatus = "Cancelled";
  order.cancelledReason = reason || "Khách hàng tự hủy đơn hàng";
  await order.save();

  // Hoàn trả lại số lượng tồn kho sản phẩm
  for (const item of order.items) {
    await Product.findByIdAndUpdate(item.product, {
      $inc: { stock: item.quantity },
    });
  }

  // Populate product details before returning
  await order.populate("items.product", "images name slug specs");

  return order;
};

/**
 * Customer: Complete online payment.
 */
const payOrder = async (orderId, userId, paymentDetails) => {
  const order = await Order.findOne({ _id: orderId, user: userId });
  if (!order) {
    throw new Error("Không tìm thấy đơn hàng");
  }

  order.paymentStatus = "Paid";
  order.paymentDetails = paymentDetails;
  await order.save();

  // Populate product details before returning
  await order.populate("items.product", "images name slug specs");

  return order;
};

/**
 * Admin: Get all orders.
 */
const adminGetOrders = async (query = {}) => {
  return await Order.find(query)
    .populate("user", "fullName email phone")
    .sort({ createdAt: -1 });
};

/**
 * Admin: Update order status.
 */
const adminUpdateOrderStatus = async (orderId, statusData) => {
  const { orderStatus, paymentStatus } = statusData;
  const order = await Order.findById(orderId);

  if (!order) {
    throw new Error("Không tìm thấy đơn hàng");
  }

  // Lưu trạng thái trước khi thay đổi để kiểm tra
  const oldStatus = order.orderStatus;

  if (orderStatus) {
    order.orderStatus = orderStatus;
  }
  if (paymentStatus) {
    order.paymentStatus = paymentStatus;
  }

  // Nếu chuyển trạng thái sang Cancelled từ các trạng thái khác, cần hoàn lại tồn kho
  if (orderStatus === "Cancelled" && oldStatus !== "Cancelled") {
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.quantity },
      });
    }
  }

  await order.save();

  // Populate product details before returning
  await order.populate("items.product", "images name slug specs");

  return order;
};

module.exports = {
  createOrder,
  getCustomerOrders,
  getOrderDetails,
  cancelOrder,
  payOrder,
  adminGetOrders,
  adminUpdateOrderStatus,
};
