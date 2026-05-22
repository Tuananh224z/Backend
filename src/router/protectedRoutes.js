const express = require('express');
const router = express.Router();

// Middleware
const { protect } = require('../middleware/auth');

// Controllers
const { getProfile, updateProfile, changePassword } = require('../controllers/authController');
const { getCart, addToCart, updateCartItem, removeFromCart, clearCart } = require('../controllers/cartController');
const { createOrder, getMyOrders, getOrderById, cancelOrder, payOrder } = require('../controllers/orderController');
const { createReview, deleteReview } = require('../controllers/reviewController');
const { getQRPaymentInfo } = require('../controllers/paymentController');

// Apply protect middleware to all routes inside this router
router.use(protect);

// Auth Profile
router.get('/auth/profile', getProfile);
router.put('/auth/profile', updateProfile);
router.put('/auth/change-password', changePassword);

// Cart management
router.get('/cart', getCart);
router.post('/cart', addToCart);
router.put('/cart', updateCartItem);
router.delete('/cart', clearCart);
router.delete('/cart/:productId', removeFromCart);

// Orders management (customer)
router.post('/orders', createOrder);
router.get('/orders/my-orders', getMyOrders);
router.get('/orders/:id', getOrderById);
router.put('/orders/:id/cancel', cancelOrder);
router.put('/orders/:id/pay', payOrder);
router.get('/orders/:id/qr-payment', getQRPaymentInfo);

// Reviews management (customer)
router.post('/reviews', createReview);
router.delete('/reviews/:id', deleteReview);

module.exports = router;
