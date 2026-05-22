const User = require("../../models/user");
const Cart = require("../../models/cart");
const bcrypt = require("bcryptjs");
const { signToken } = require("../utils/token");

/**
 * Service to handle registration logic.
 */
const registerUser = async (userData) => {
  const { email, password, fullName, phone, address } = userData;

  // 1. Kiểm tra email tồn tại
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new Error("Email đã được sử dụng bởi tài khoản khác");
  }

  // 2. Mã hóa mật khẩu
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // 3. Tạo User mới
  const newUser = await User.create({
    email,
    password: hashedPassword,
    fullName,
    phone,
    address,
  });

  // 4. Tạo giỏ hàng trống cho User mới
  await Cart.create({ user: newUser._id, items: [] });

  // 5. Tạo token
  const token = signToken(newUser._id);

  // Ẩn mật khẩu khi trả về
  const userResponse = newUser.toObject();
  delete userResponse.password;

  return { user: userResponse, token };
};

/**
 * Service to handle login logic.
 */
const loginUser = async (email, password) => {
  // 1. Tìm user theo email
  const user = await User.findOne({ email });
  if (!user) {
    throw new Error("Email hoặc mật khẩu không chính xác");
  }

  // 2. Kiểm tra trạng thái hoạt động
  if (!user.isActive) {
    throw new Error("Tài khoản của bạn đã bị khóa");
  }

  // 3. So khớp mật khẩu
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new Error("Email hoặc mật khẩu không chính xác");
  }

  // 4. Tạo token
  const token = signToken(user._id);

  const userResponse = user.toObject();
  delete userResponse.password;

  return { user: userResponse, token };
};

/**
 * Service to retrieve profile.
 */
const getUserProfile = async (userId) => {
  const user = await User.findById(userId).select("-password");
  if (!user) {
    throw new Error("Người dùng không tồn tại");
  }
  return user;
};

/**
 * Service to update profile.
 */
const updateUserProfile = async (userId, profileData) => {
  const allowedUpdates = ["fullName", "phone", "avatar", "address", "addresses"];
  const updates = {};

  // Chỉ cho phép update các trường chỉ định
  allowedUpdates.forEach((field) => {
    if (profileData[field] !== undefined) {
      updates[field] = profileData[field];
    }
  });

  // Nếu có cập nhật danh sách địa chỉ (addresses)
  if (updates.addresses && Array.isArray(updates.addresses)) {
    // Đảm bảo chỉ có tối đa 1 địa chỉ mặc định
    let defaultCount = updates.addresses.filter(addr => addr.isDefault).length;
    
    if (defaultCount === 0 && updates.addresses.length > 0) {
      // Nếu không có địa chỉ nào mặc định, đặt địa chỉ đầu tiên làm mặc định
      updates.addresses[0].isDefault = true;
      defaultCount = 1;
    } else if (defaultCount > 1) {
      // Nếu có nhiều hơn 1 địa chỉ mặc định, chỉ giữ lại cái cuối cùng được set làm mặc định
      let foundFirst = false;
      for (let i = updates.addresses.length - 1; i >= 0; i--) {
        if (updates.addresses[i].isDefault) {
          if (!foundFirst) {
            foundFirst = true;
          } else {
            updates.addresses[i].isDefault = false;
          }
        }
      }
    }

    // Tìm địa chỉ mặc định để đồng bộ vào trường address gốc
    const defaultAddr = updates.addresses.find(addr => addr.isDefault);
    if (defaultAddr) {
      updates.address = {
        street: defaultAddr.street || "",
        ward: defaultAddr.ward || "",
        district: defaultAddr.district || "",
        city: defaultAddr.city || ""
      };
      
      // Đồng thời cập nhật fullName và phone gốc theo địa chỉ mặc định
      if (profileData.fullName === undefined) {
        updates.fullName = defaultAddr.fullName;
      }
      if (profileData.phone === undefined) {
        updates.phone = defaultAddr.phone;
      }
    } else {
      // Nếu xóa hết địa chỉ, reset address gốc
      updates.address = { street: "", ward: "", district: "", city: "" };
    }
  }

  const updatedUser = await User.findByIdAndUpdate(userId, { $set: updates }, { new: true, runValidators: true }).select("-password");

  if (!updatedUser) {
    throw new Error("Người dùng không tồn tại");
  }

  return updatedUser;
};

/**
 * Service to change password.
 */
const changeUserPassword = async (userId, oldPassword, newPassword) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("Người dùng không tồn tại");
  }

  // So sánh mật khẩu cũ
  const isMatch = await bcrypt.compare(oldPassword, user.password);
  if (!isMatch) {
    throw new Error("Mật khẩu cũ không chính xác");
  }

  // Mã hóa mật khẩu mới
  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(newPassword, salt);
  
  await user.save();
  return { message: "Đổi mật khẩu thành công" };
};

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  changeUserPassword,
};
