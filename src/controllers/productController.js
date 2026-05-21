const productService = require("../services/productService");

const getProducts = async (req, res) => {
  try {
    const result = await productService.queryProducts(req.query);
    res.status(200).json({
      status: "success",
      ...result,
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};

const getProductByIdOrSlug = async (req, res) => {
  try {
    const product = await productService.getProductByIdOrSlug(req.params.idOrSlug);
    res.status(200).json({
      status: "success",
      data: product,
    });
  } catch (error) {
    res.status(404).json({
      status: "fail",
      message: error.message,
    });
  }
};

const createProduct = async (req, res) => {
  try {
    const product = await productService.createProduct(req.body);
    res.status(201).json({
      status: "success",
      data: product,
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};

const updateProduct = async (req, res) => {
  try {
    const product = await productService.updateProduct(req.params.id, req.body);
    res.status(200).json({
      status: "success",
      data: product,
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};

const deleteProduct = async (req, res) => {
  try {
    await productService.deleteProduct(req.params.id);
    res.status(200).json({
      status: "success",
      message: "Xóa sản phẩm thành công",
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};

/**
 * Handle files upload from multer array and return access URLs.
 */
const uploadImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        status: "fail",
        message: "Không có file nào được upload",
      });
    }

    // Map multer files to URLs
    const imageUrls = req.files.map((file) => `/uploads/${file.filename}`);

    res.status(200).json({
      status: "success",
      urls: imageUrls,
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};

module.exports = {
  getProducts,
  getProductByIdOrSlug,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadImages,
};
