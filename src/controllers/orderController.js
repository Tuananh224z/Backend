const orderService = require("../services/orderService");

const createOrder = async (req, res) => {
  try {
    const order = await orderService.createOrder(req.user._id, req.body);
    res.status(201).json({
      status: "success",
      data: order,
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};

const getMyOrders = async (req, res) => {
  try {
    const orders = await orderService.getCustomerOrders(req.user._id);
    res.status(200).json({
      status: "success",
      results: orders.length,
      data: orders,
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};

const getOrderById = async (req, res) => {
  try {
    // Nếu là admin thì không cần kiểm tra quyền sở hữu đơn hàng của user cụ thể
    const userId = req.user.role === "admin" ? null : req.user._id;
    const order = await orderService.getOrderDetails(req.params.id, userId);
    res.status(200).json({
      status: "success",
      data: order,
    });
  } catch (error) {
    res.status(404).json({
      status: "fail",
      message: error.message,
    });
  }
};

const cancelOrder = async (req, res) => {
  try {
    const { reason } = req.body;
    const order = await orderService.cancelOrder(req.params.id, req.user._id, reason);
    res.status(200).json({
      status: "success",
      message: "Hủy đơn hàng thành công",
      data: order,
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};

const payOrder = async (req, res) => {
  try {
    const order = await orderService.payOrder(req.params.id, req.user._id, req.body);
    res.status(200).json({
      status: "success",
      message: "Thanh toán đơn hàng thành công",
      data: order,
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};

// --- ADMIN CONTROLLERS ---

const getOrders = async (req, res) => {
  try {
    const orders = await orderService.adminGetOrders(req.query);
    res.status(200).json({
      status: "success",
      results: orders.length,
      data: orders,
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const order = await orderService.adminUpdateOrderStatus(req.params.id, req.body);
    res.status(200).json({
      status: "success",
      message: "Cập nhật trạng thái đơn hàng thành công",
      data: order,
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};

module.exports = {
  createOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
  payOrder,
  getOrders,
  updateOrderStatus,
};
