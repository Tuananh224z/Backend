const User = require("../../models/user");

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

  // Khóa hoặc Mở khóa
  user.isActive = !user.isActive;
  await user.save();

  const userResponse = user.toObject();
  delete userResponse.password;
  return userResponse;
};

/**
 * Admin: Update user role (e.g. promote customer to admin).
 */
const updateUserRoleAdmin = async (userId, role) => {
  if (!["customer", "admin"].includes(role)) {
    throw new Error("Vai trò không hợp lệ");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new Error("Không tìm thấy người dùng");
  }

  user.role = role;
  await user.save();

  const userResponse = user.toObject();
  delete userResponse.password;
  return userResponse;
};

module.exports = {
  getUsersAdmin,
  getUserDetailsAdmin,
  toggleUserLockAdmin,
  updateUserRoleAdmin,
};
