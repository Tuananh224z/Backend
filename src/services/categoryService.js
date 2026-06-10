const Category = require("../models/category");

/**
 * Get active categories.
 */
const getAllCategories = async (query = {}) => {
  const { showAll, ...rest } = query;
  const filter = { ...rest };
  if (showAll !== "true" && showAll !== true) {
    filter.isActive = { $ne: false };
  }
  return await Category.find(filter);
};

/**
 * Get category by ID or Slug.
 */
const getCategoryByIdOrSlug = async (idOrSlug) => {
  let category;
  if (idOrSlug.match(/^[0-9a-fA-F]{24}$/)) {
    category = await Category.findById(idOrSlug);
  } else {
    category = await Category.findOne({ slug: idOrSlug });
  }

  if (!category) {
    throw new Error("Không tìm thấy danh mục");
  }
  return category;
};

/**
 * Admin: Create category.
 */
const createCategory = async (categoryData) => {
  const { name, slug, description, image, isActive } = categoryData;
  const finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const existingCategory = await Category.findOne({ slug: finalSlug });
  if (existingCategory) {
    throw new Error("Slug danh mục đã tồn tại");
  }

  return await Category.create({
    name,
    slug: finalSlug,
    description,
    image,
    isActive,
  });
};

/**
 * Admin: Update category.
 */
const updateCategory = async (categoryId, updateData) => {
  if (updateData.slug) {
    const existingCategory = await Category.findOne({ slug: updateData.slug, _id: { $ne: categoryId } });
    if (existingCategory) {
      throw new Error("Slug danh mục đã tồn tại");
    }
  }

  const updatedCategory = await Category.findByIdAndUpdate(categoryId, { $set: updateData }, { new: true, runValidators: true });
  if (!updatedCategory) {
    throw new Error("Không tìm thấy danh mục để cập nhật");
  }

  return updatedCategory;
};

/**
 * Admin: Delete category.
 */
const deleteCategory = async (categoryId) => {
  const deletedCategory = await Category.findByIdAndDelete(categoryId);
  if (!deletedCategory) {
    throw new Error("Không tìm thấy danh mục để xóa");
  }
  return deletedCategory;
};

module.exports = {
  getAllCategories,
  getCategoryByIdOrSlug,
  createCategory,
  updateCategory,
  deleteCategory,
};
