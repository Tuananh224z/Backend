const cartService = require("../services/cartService");

const getCart = async (req, res) => {
  try {
    const cart = await cartService.getUserCart(req.user._id);
    res.status(200).json({
      status: "success",
      data: cart,
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};

const addToCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    if (!productId) {
      return res.status(400).json({
        status: "fail",
        message: "Vui lòng cung cấp ID sản phẩm",
      });
    }
    const cart = await cartService.addItemToCart(req.user._id, productId, quantity);
    res.status(200).json({
      status: "success",
      data: cart,
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};

const updateCartItem = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    if (!productId || quantity === undefined) {
      return res.status(400).json({
        status: "fail",
        message: "Vui lòng cung cấp ID sản phẩm và số lượng mới",
      });
    }
    const cart = await cartService.updateCartItemQty(req.user._id, productId, quantity);
    res.status(200).json({
      status: "success",
      data: cart,
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};

const removeFromCart = async (req, res) => {
  try {
    const cart = await cartService.removeItemFromCart(req.user._id, req.params.productId);
    res.status(200).json({
      status: "success",
      data: cart,
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};

const clearCart = async (req, res) => {
  try {
    const cart = await cartService.clearUserCart(req.user._id);
    res.status(200).json({
      status: "success",
      data: cart,
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
};
