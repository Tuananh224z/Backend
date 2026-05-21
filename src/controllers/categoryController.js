const categoryService = require("../services/categoryService");

const getCategories = async (req, res) => {
  try {
    const categories = await categoryService.getAllCategories(req.query);
    res.status(200).json({
      status: "success",
      results: categories.length,
      data: categories,
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};

const getCategoryByIdOrSlug = async (req, res) => {
  try {
    const category = await categoryService.getCategoryByIdOrSlug(req.params.idOrSlug);
    res.status(200).json({
      status: "success",
      data: category,
    });
  } catch (error) {
    res.status(404).json({
      status: "fail",
      message: error.message,
    });
  }
};

const createCategory = async (req, res) => {
  try {
    const category = await categoryService.createCategory(req.body);
    res.status(201).json({
      status: "success",
      data: category,
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};

const updateCategory = async (req, res) => {
  try {
    const category = await categoryService.updateCategory(req.params.id, req.body);
    res.status(200).json({
      status: "success",
      data: category,
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};

const deleteCategory = async (req, res) => {
  try {
    await categoryService.deleteCategory(req.params.id);
    res.status(200).json({
      status: "success",
      message: "Xóa danh mục thành công",
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};

module.exports = {
  getCategories,
  getCategoryByIdOrSlug,
  createCategory,
  updateCategory,
  deleteCategory,
};
