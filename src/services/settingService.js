const SystemSettings = require("../models/systemSettings");

/**
 * Get active system settings.
 * Automatically creates a default one if none exists.
 */
const getSystemSettings = async () => {
  let settings = await SystemSettings.findOne();
  if (!settings) {
    settings = await SystemSettings.create({
      logo: "",
      banners: [],
      contactInfo: {
        address: "123 Đường Laptop, Hà Nội",
        phone: "0123456789",
        email: "contact@laptopshop.com",
      },
    });
  }
  return settings;
};

/**
 * Admin: Update system settings.
 */
const updateSystemSettings = async (updateData, adminId) => {
  let settings = await SystemSettings.findOne();
  
  const finalData = {
    ...updateData,
    updatedBy: adminId,
  };

  if (!settings) {
    settings = await SystemSettings.create(finalData);
  } else {
    settings = await SystemSettings.findByIdAndUpdate(
      settings._id,
      { $set: finalData },
      { new: true, runValidators: true }
    );
  }

  return settings;
};

module.exports = {
  getSystemSettings,
  updateSystemSettings,
};
