const express = require('express');
const router = express.Router();

// Middlewares
const loginLimiter = require('../middleware/loginLimiter');

// Controllers
const { register, login } = require('../controllers/authController');
const { getBrands, getBrandByIdOrSlug } = require('../controllers/brandController');
const { getCategories, getCategoryByIdOrSlug } = require('../controllers/categoryController');
const { getProducts, getProductByIdOrSlug } = require('../controllers/productController');
const { getProductReviews } = require('../controllers/reviewController');
const { getSessionMessages } = require('../controllers/chatController');
const { getSettings } = require('../controllers/settingController');

// Authentication public routes
router.post('/auth/register', register);
router.post('/auth/login', loginLimiter, login);

// Brands public routes
router.get('/brands', getBrands);
router.get('/brands/:idOrSlug', getBrandByIdOrSlug);

// Categories public routes
router.get('/categories', getCategories);
router.get('/categories/:idOrSlug', getCategoryByIdOrSlug);

// Products public routes
router.get('/products', getProducts);
router.get('/products/:idOrSlug', getProductByIdOrSlug);

// Reviews public routes
router.get('/reviews/product/:productId', getProductReviews);

// Chat history public routes
router.get('/chat/sessions/:sessionId/messages', getSessionMessages);

// System settings public routes
router.get('/system/settings', getSettings);

module.exports = router;
