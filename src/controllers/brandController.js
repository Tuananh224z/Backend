const brandService = require("../services/brandService");

const getBrands = async (req, res) => {
  try {
    const brands = await brandService.getAllBrands(req.query);
    res.status(200).json({
      status: "success",
      results: brands.length,
      data: brands,
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};

const getBrandByIdOrSlug = async (req, res) => {
  try {
    const brand = await brandService.getBrandByIdOrSlug(req.params.idOrSlug);
    res.status(200).json({
      status: "success",
      data: brand,
    });
  } catch (error) {
    res.status(404).json({
      status: "fail",
      message: error.message,
    });
  }
};

const createBrand = async (req, res) => {
  try {
    const brand = await brandService.createBrand(req.body);
    res.status(201).json({
      status: "success",
      data: brand,
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};

const updateBrand = async (req, res) => {
  try {
    const brand = await brandService.updateBrand(req.params.id, req.body);
    res.status(200).json({
      status: "success",
      data: brand,
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};

const deleteBrand = async (req, res) => {
  try {
    await brandService.deleteBrand(req.params.id);
    res.status(200).json({
      status: "success",
      message: "Xóa thương hiệu thành công",
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};

module.exports = {
  getBrands,
  getBrandByIdOrSlug,
  createBrand,
  updateBrand,
  deleteBrand,
};
