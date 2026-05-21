const Brand = require("../../models/brand");

/**
 * Get active brands (public).
 */
const getAllBrands = async (query = {}) => {
  const filter = { isActive: true, ...query };
  return await Brand.find(filter);
};

/**
 * Get brand by ID or Slug.
 */
const getBrandByIdOrSlug = async (idOrSlug) => {
  let brand;
  // Kiểm tra nếu là ObjectId hợp lệ
  if (idOrSlug.match(/^[0-9a-fA-F]{24}$/)) {
    brand = await Brand.findById(idOrSlug);
  } else {
    brand = await Brand.findOne({ slug: idOrSlug });
  }

  if (!brand) {
    throw new Error("Không tìm thấy thương hiệu");
  }
  return brand;
};

/**
 * Admin: Create brand.
 */
const createBrand = async (brandData) => {
  const { name, slug, description, logo, isActive } = brandData;
  
  // Tự sinh slug từ name nếu không truyền vào
  const finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const existingBrand = await Brand.findOne({ slug: finalSlug });
  if (existingBrand) {
    throw new Error("Slug thương hiệu đã tồn tại");
  }

  return await Brand.create({
    name,
    slug: finalSlug,
    description,
    logo,
    isActive,
  });
};

/**
 * Admin: Update brand.
 */
const updateBrand = async (brandId, updateData) => {
  if (updateData.slug) {
    const existingBrand = await Brand.findOne({ slug: updateData.slug, _id: { $ne: brandId } });
    if (existingBrand) {
      throw new Error("Slug thương hiệu đã tồn tại");
    }
  }

  const updatedBrand = await Brand.findByIdAndUpdate(brandId, { $set: updateData }, { new: true, runValidators: true });
  if (!updatedBrand) {
    throw new Error("Không tìm thấy thương hiệu để cập nhật");
  }

  return updatedBrand;
};

/**
 * Admin: Delete brand.
 */
const deleteBrand = async (brandId) => {
  const deletedBrand = await Brand.findByIdAndDelete(brandId);
  if (!deletedBrand) {
    throw new Error("Không tìm thấy thương hiệu để xóa");
  }
  return deletedBrand;
};

module.exports = {
  getAllBrands,
  getBrandByIdOrSlug,
  createBrand,
  updateBrand,
  deleteBrand,
};
