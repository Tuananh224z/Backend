const Product = require("../../models/product");
const Category = require("../../models/category");
const Brand = require("../../models/brand");

/**
 * Get filtered and paginated list of active products.
 */
const queryProducts = async (queryParams) => {
  const { category, brand, minPrice, maxPrice, search, isFeatured, promotion, sortBy, page = 1, limit = 10 } = queryParams;
  const filter = { isActive: true };

  // 1. Lọc theo danh mục
  if (category) {
    if (category.match(/^[0-9a-fA-F]{24}$/)) {
      filter.category = category;
    } else {
      const catDoc = await Category.findOne({ slug: category });
      if (catDoc) filter.category = catDoc._id;
      else filter.category = null; // Nếu truyền slug sai, trả về rỗng
    }
  }

  // 2. Lọc theo thương hiệu
  if (brand) {
    if (brand.match(/^[0-9a-fA-F]{24}$/)) {
      filter.brand = brand;
    } else {
      const brandDoc = await Brand.findOne({ slug: brand });
      if (brandDoc) filter.brand = brandDoc._id;
      else filter.brand = null;
    }
  }

  // 3. Lọc theo khoảng giá
  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined && minPrice !== "") filter.price.$gte = Number(minPrice);
    if (maxPrice !== undefined && maxPrice !== "") filter.price.$lte = Number(maxPrice);
    // Xóa trường price nếu không có điều kiện nào thỏa
    if (Object.keys(filter.price).length === 0) delete filter.price;
  }

  // 4. Tìm kiếm từ khóa (sử dụng Text Index của MongoDB)
  if (search && search.trim() !== "") {
    filter.$text = { $search: search };
  }

  // 5. Lọc sản phẩm nổi bật
  if (isFeatured !== undefined && isFeatured !== "") {
    filter.isFeatured = isFeatured === "true" || isFeatured === true;
  }

  // 6. Lọc sản phẩm khuyến mại (có discountPrice > 0)
  if (promotion === "true" || promotion === true) {
    filter.discountPrice = { $gt: 0 };
  }

  // Khởi tạo Query và populate các liên kết danh mục/thương hiệu
  let dbQuery = Product.find(filter)
    .populate("category", "name slug")
    .populate("brand", "name slug");

  // 7. Sắp xếp (Sorting)
  if (sortBy) {
    if (sortBy === "priceAsc") {
      dbQuery = dbQuery.sort({ price: 1 });
    } else if (sortBy === "priceDesc") {
      dbQuery = dbQuery.sort({ price: -1 });
    } else if (sortBy === "new") {
      dbQuery = dbQuery.sort({ createdAt: -1 });
    } else if (sortBy === "ratings") {
      dbQuery = dbQuery.sort({ ratingsAverage: -1 });
    }
  } else {
    // Mặc định sắp xếp sản phẩm mới nhất lên đầu
    dbQuery = dbQuery.sort({ createdAt: -1 });
  }

  // 8. Phân trang (Pagination)
  const limitNum = Number(limit);
  const pageNum = Number(page);
  const skip = (pageNum - 1) * limitNum;

  dbQuery = dbQuery.skip(skip).limit(limitNum);

  const products = await dbQuery;
  const total = await Product.countDocuments(filter);

  return {
    products,
    total,
    page: pageNum,
    limit: limitNum,
    pages: Math.ceil(total / limitNum),
  };
};

/**
 * Get product details by ID or Slug.
 */
const getProductByIdOrSlug = async (idOrSlug) => {
  let product;
  if (idOrSlug.match(/^[0-9a-fA-F]{24}$/)) {
    product = await Product.findById(idOrSlug)
      .populate("category", "name slug")
      .populate("brand", "name slug");
  } else {
    product = await Product.findOne({ slug: idOrSlug })
      .populate("category", "name slug")
      .populate("brand", "name slug");
  }

  if (!product) {
    throw new Error("Không tìm thấy sản phẩm");
  }

  return product;
};

/**
 * Admin: Create a new product.
 */
const createProduct = async (productData) => {
  const { name, slug, category, brand, price, discountPrice, images, stock, description, specs, isFeatured, isActive } = productData;

  const finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const existingProduct = await Product.findOne({ slug: finalSlug });
  if (existingProduct) {
    throw new Error("Slug sản phẩm đã tồn tại");
  }

  return await Product.create({
    name,
    slug: finalSlug,
    category,
    brand,
    price,
    discountPrice,
    images,
    stock,
    description,
    specs,
    isFeatured,
    isActive,
  });
};

/**
 * Admin: Update an existing product.
 */
const updateProduct = async (productId, updateData) => {
  if (updateData.slug) {
    const existingProduct = await Product.findOne({ slug: updateData.slug, _id: { $ne: productId } });
    if (existingProduct) {
      throw new Error("Slug sản phẩm đã tồn tại");
    }
  }

  const updatedProduct = await Product.findByIdAndUpdate(productId, { $set: updateData }, { new: true, runValidators: true });
  if (!updatedProduct) {
    throw new Error("Không tìm thấy sản phẩm để cập nhật");
  }

  return updatedProduct;
};

/**
 * Admin: Delete a product.
 */
const deleteProduct = async (productId) => {
  const deletedProduct = await Product.findByIdAndDelete(productId);
  if (!deletedProduct) {
    throw new Error("Không tìm thấy sản phẩm để xóa");
  }
  return deletedProduct;
};

module.exports = {
  queryProducts,
  getProductByIdOrSlug,
  createProduct,
  updateProduct,
  deleteProduct,
};
