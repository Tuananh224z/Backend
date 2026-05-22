const express = require('express');
const router = express.Router();

// Middlewares
const { protect } = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');
const upload = require('../middleware/upload');

// Controllers
const { createBrand, updateBrand, deleteBrand } = require('../controllers/brandController');
const { createCategory, updateCategory, deleteCategory } = require('../controllers/categoryController');
const { createProduct, updateProduct, deleteProduct, uploadImages } = require('../controllers/productController');

const { getOrders, updateOrderStatus } = require('../controllers/orderController');
const { getReviewsAdmin, updateReviewStatus, replyReviewAdmin } = require('../controllers/reviewController');
const { getChatSessions, getPopularQuestions } = require('../controllers/chatController');
const { getUsersAdmin, getUserDetailsAdmin, toggleUserLockAdmin, updateUserRoleAdmin, createUserAdmin } = require('../controllers/userController');
const { updateSettings } = require('../controllers/settingController');
const { getStatsSummary, getChatbotStats, getUserStats } = require('../controllers/statsController');

// Apply protection and role restriction to all admin routes
router.use(protect);
router.use(isAdmin);

// Brands management
router.post('/brands', createBrand);
router.put('/brands/:id', updateBrand);
router.delete('/brands/:id', deleteBrand);

// Categories management
router.post('/categories', createCategory);
router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

// Products management & image uploading
router.post('/products', createProduct);
router.put('/products/:id', updateProduct);
router.delete('/products/:id', deleteProduct);
router.post('/products/upload', upload.array('images', 10), uploadImages);



// Orders management (admin)
router.get('/orders', getOrders);
router.put('/orders/:id/status', updateOrderStatus);

// Reviews management (admin)
router.get('/reviews', getReviewsAdmin);
router.put('/reviews/:id/status', updateReviewStatus);
router.put('/reviews/:id/reply', replyReviewAdmin);

// Chatbot session monitoring
router.get('/chat/sessions', getChatSessions);
router.get('/chat/popular-questions', getPopularQuestions);

// Users management (admin)
router.get('/users', getUsersAdmin);
router.post('/users', createUserAdmin);
router.get('/users/:id', getUserDetailsAdmin);
router.put('/users/:id/toggle-lock', toggleUserLockAdmin);
router.put('/users/:id/role', updateUserRoleAdmin);

// System settings & Dashboard statistics
router.put('/system/settings', updateSettings);
router.get('/system/stats/summary', getStatsSummary);
router.get('/system/stats/chatbot', getChatbotStats);
router.get('/system/stats/users', getUserStats);

module.exports = router;
