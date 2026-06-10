const User = require("../models/user");

/**
 * Admin: Get all users.
 */
const getUsersAdmin = async (query = {}) => {
  return await User.find(query).select("-password").sort({ createdAt: -1 });
};

/**
 * Admin: Get specific user details.
 */
const getUserDetailsAdmin = async (userId) => {
  const user = await User.findById(userId).select("-password");
  if (!user) {
    throw new Error("Không tìm thấy người dùng");
  }
  return user;
};

/**
 * Admin: Toggle account active status (Lock/Unlock).
 */
const toggleUserLockAdmin = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("Không tìm thấy người dùng");
  }

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { isActive: !user.isActive },
    { new: true, runValidators: true }
  ).select("-password");

  return updatedUser;
};

/**
 * Admin: Update user role (e.g. promote customer to admin).
 */
const updateUserRoleAdmin = async (userId, role) => {
  if (!["customer", "admin"].includes(role)) {
    throw new Error("Vai trò không hợp lệ");
  }

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { role },
    { new: true, runValidators: true }
  ).select("-password");

  if (!updatedUser) {
    throw new Error("Không tìm thấy người dùng");
  }

  return updatedUser;
};

/**
 * Admin: Create a new user (admin or customer).
 */
const createUserAdmin = async (userData) => {
  const { email, password, fullName, phone, role, address } = userData;

  if (!email || !password || !fullName) {
    throw new Error("Vui lòng điền đầy đủ các trường bắt buộc (Email, Mật khẩu, Họ tên)");
  }

  // 1. Kiểm tra email tồn tại
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new Error("Email đã được sử dụng bởi tài khoản khác");
  }

  const bcrypt = require("bcryptjs");
  const Cart = require("../models/cart");

  // 2. Mã hóa mật khẩu
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // 3. Tạo User mới
  const newUser = await User.create({
    email,
    password: hashedPassword,
    fullName,
    phone: phone || "",
    role: role || "customer",
    address: {
      street: address?.street || "",
      ward: address?.ward || "",
      district: address?.district || "",
      city: address?.city || "",
    },
  });

  // 4. Tạo giỏ hàng trống cho User mới
  await Cart.create({ user: newUser._id, items: [] });

  // Ẩn mật khẩu khi trả về
  const userResponse = newUser.toObject();
  delete userResponse.password;

  return userResponse;
};

module.exports = {
  getUsersAdmin,
  getUserDetailsAdmin,
  toggleUserLockAdmin,
  updateUserRoleAdmin,
  createUserAdmin,
};
