const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payments.js');
const { isLoggedIn } = require('../middleware.js');

router.get('/booked-dates/:id', paymentController.getBookedDates);
router.post('/create-session/:id', isLoggedIn, paymentController.createCheckoutSession);
router.get('/success', isLoggedIn, paymentController.paymentSuccess);
router.get('/history', isLoggedIn, paymentController.userBookingHistory);
router.get('/cancel', paymentController.paymentCancel);

module.exports = router;
