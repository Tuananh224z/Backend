const Cart = require("../../models/cart");
const Product = require("../../models/product");

/**
 * Get user cart, populated with product details.
 */
const getUserCart = async (userId) => {
  let cart = await Cart.findOne({ user: userId }).populate("items.product", "name price discountPrice images stock slug");
  
  if (!cart) {
    // Dự phòng tạo giỏ hàng mới nếu chưa có
    cart = await Cart.create({ user: userId, items: [] });
  }

  return cart;
};

/**
 * Add an item to the cart.
 */
const addItemToCart = async (userId, productId, quantity = 1) => {
  // 1. Kiểm tra sản phẩm có tồn tại và còn hàng không
  const product = await Product.findById(productId);
  if (!product) {
    throw new Error("Sản phẩm không tồn tại");
  }
  if (!product.isActive) {
    throw new Error("Sản phẩm này đã ngừng kinh doanh");
  }
  if (product.stock < quantity) {
    throw new Error(`Không đủ hàng trong kho. Còn lại: ${product.stock}`);
  }

  // Lấy giá sản phẩm (lấy giá khuyến mại nếu có)
  const productPrice = product.discountPrice && product.discountPrice > 0 ? product.discountPrice : product.price;

  // 2. Tìm hoặc tạo giỏ hàng của user
  let cart = await Cart.findOne({ user: userId });
  if (!cart) {
    cart = new Cart({ user: userId, items: [] });
  }

  // 3. Kiểm tra sản phẩm đã có trong giỏ chưa
  const itemIndex = cart.items.findIndex((item) => item.product.toString() === productId);

  if (itemIndex > -1) {
    // Đã có trong giỏ hàng: Cập nhật số lượng mới và kiểm tra tồn kho tổng cộng
    const newQty = cart.items[itemIndex].quantity + quantity;
    if (product.stock < newQty) {
      throw new Error(`Không thể thêm. Tổng số lượng trong giỏ (${newQty}) vượt quá tồn kho (${product.stock})`);
    }
    cart.items[itemIndex].quantity = newQty;
    cart.items[itemIndex].price = productPrice; // Cập nhật lại giá mới nhất
  } else {
    // Chưa có: Thêm item mới
    cart.items.push({
      product: productId,
      quantity,
      price: productPrice,
    });
  }

  await cart.save();
  return await getUserCart(userId);
};

/**
 * Update quantity of an item in the cart.
 */
const updateCartItemQty = async (userId, productId, quantity) => {
  if (quantity < 1) {
    throw new Error("Số lượng sản phẩm tối thiểu phải là 1");
  }

  // Kiểm tra tồn kho sản phẩm
  const product = await Product.findById(productId);
  if (!product) {
    throw new Error("Sản phẩm không tồn tại");
  }
  if (product.stock < quantity) {
    throw new Error(`Không đủ hàng trong kho. Còn lại: ${product.stock}`);
  }

  const cart = await Cart.findOne({ user: userId });
  if (!cart) {
    throw new Error("Không tìm thấy giỏ hàng");
  }

  const itemIndex = cart.items.findIndex((item) => item.product.toString() === productId);
  if (itemIndex === -1) {
    throw new Error("Sản phẩm không nằm trong giỏ hàng");
  }

  // Cập nhật số lượng và giá mới nhất
  const productPrice = product.discountPrice && product.discountPrice > 0 ? product.discountPrice : product.price;
  cart.items[itemIndex].quantity = quantity;
  cart.items[itemIndex].price = productPrice;

  await cart.save();
  return await getUserCart(userId);
};

/**
 * Remove an item from the cart.
 */
const removeItemFromCart = async (userId, productId) => {
  const cart = await Cart.findOne({ user: userId });
  if (!cart) {
    throw new Error("Không tìm thấy giỏ hàng");
  }

  cart.items = cart.items.filter((item) => item.product.toString() !== productId);
  await cart.save();

  return await getUserCart(userId);
};

/**
 * Clear all items from the cart.
 */
const clearUserCart = async (userId) => {
  const cart = await Cart.findOne({ user: userId });
  if (!cart) {
    throw new Error("Không tìm thấy giỏ hàng");
  }

  cart.items = [];
  await cart.save();

  return cart;
};

module.exports = {
  getUserCart,
  addItemToCart,
  updateCartItemQty,
  removeItemFromCart,
  clearUserCart,
};
