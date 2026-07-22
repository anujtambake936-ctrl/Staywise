const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Listing = require('../models/listing.js');
const Payment = require('../models/payment.js');

// ─── helpers ────────────────────────────────────────────────────────────────

function nightsBetween(checkIn, checkOut) {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((new Date(checkOut) - new Date(checkIn)) / msPerDay);
}

/**
 * Returns true when [checkIn, checkOut) overlaps any existing [a.checkIn, a.checkOut).
 * Two ranges overlap when: checkIn < a.checkOut AND checkOut > a.checkIn
 */
async function hasConflict(listingId, checkIn, checkOut, excludePaymentId = null) {
  const query = {
    listing: listingId,
    status: 'paid',
    checkIn:  { $lt: new Date(checkOut) },
    checkOut: { $gt: new Date(checkIn) },
  };
  if (excludePaymentId) query._id = { $ne: excludePaymentId };
  const conflict = await Payment.findOne(query).lean();
  return !!conflict;
}

// ─── controllers ────────────────────────────────────────────────────────────

/**
 * GET /payments/booked-dates/:id
 * Returns array of { checkIn, checkOut } for all paid bookings on a listing.
 * Used by the front-end calendar to disable already-booked dates.
 */
module.exports.getBookedDates = async (req, res) => {
  try {
    const bookings = await Payment.find({
      listing: req.params.id,
      status: 'paid',
      checkIn:  { $exists: true },
      checkOut: { $exists: true },
    }).select('checkIn checkOut').lean();

    res.json(bookings);
  } catch (err) {
    console.error('getBookedDates error:', err);
    res.status(500).json({ error: 'Unable to fetch booked dates' });
  }
};

/**
 * POST /payments/create-session/:id
 * Expects body: { checkIn: 'YYYY-MM-DD', checkOut: 'YYYY-MM-DD' }
 */
module.exports.createCheckoutSession = async (req, res) => {
  try {
    const { id } = req.params;
    const listing = await Listing.findById(id);
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // ── validate dates ──────────────────────────────────────────────────────
    const { checkIn, checkOut } = req.body;
    if (!checkIn || !checkOut) {
      return res.status(400).json({ error: 'Please select check-in and check-out dates.' });
    }

    const checkInDate  = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const today        = new Date(); today.setHours(0, 0, 0, 0);

    if (isNaN(checkInDate) || isNaN(checkOutDate)) {
      return res.status(400).json({ error: 'Invalid dates provided.' });
    }
    if (checkInDate < today) {
      return res.status(400).json({ error: 'Check-in date cannot be in the past.' });
    }
    if (checkOutDate <= checkInDate) {
      return res.status(400).json({ error: 'Check-out must be after check-in.' });
    }

    const nights = nightsBetween(checkInDate, checkOutDate);
    if (nights < 1) {
      return res.status(400).json({ error: 'Minimum stay is 1 night.' });
    }

    // ── conflict check ──────────────────────────────────────────────────────
    const conflict = await hasConflict(listing._id, checkInDate, checkOutDate);
    if (conflict) {
      return res.status(409).json({ error: 'These dates are already booked. Please choose different dates.' });
    }

    // ── compute amount (subtotal + 18% GST) ─────────────────────────────────
    const subtotal    = listing.price * nights;
    const gst         = Math.round(subtotal * 0.18);
    const grandTotal  = subtotal + gst;
    const totalAmount = grandTotal * 100; // paise for Stripe
    const payment = new Payment({
      user:     req.user._id,
      listing:  listing._id,
      amount:   totalAmount,
      currency: 'INR',
      status:   'pending',
      checkIn:  checkInDate,
      checkOut: checkOutDate,
      nights,
    });
    await payment.save();

    // ── stripe checkout ─────────────────────────────────────────────────────
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'inr',
          product_data: {
            name: listing.title,
            description: `${listing.location} · ${nights} night${nights > 1 ? 's' : ''} (${checkIn} → ${checkOut}) incl. 18% GST`,
          },
          unit_amount: totalAmount,
        },
        quantity: 1,
      }],
      customer_email: req.user.email || req.user.username,
      mode: 'payment',
      success_url: `${req.protocol}://${req.get('host')}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${req.protocol}://${req.get('host')}/payments/cancel`,
      metadata: {
        paymentId: payment._id.toString(),
        listingId: listing._id.toString(),
        checkIn,
        checkOut,
        nights: String(nights),
      },
    });

    payment.stripeSessionId = session.id;
    await payment.save();

    res.json({ id: session.id });
  } catch (err) {
    console.error('Stripe checkout session error:', err);
    res.status(500).json({ error: err.message || 'Unable to create Stripe checkout session' });
  }
};

/**
 * GET /payments/success
 */
module.exports.paymentSuccess = async (req, res) => {
  try {
    const sessionId = req.query.session_id;
    if (!sessionId) {
      req.flash('error', 'Missing session information');
      return res.redirect('/listings');
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!session || session.payment_status !== 'paid') {
      req.flash('error', 'Payment not completed');
      return res.redirect('/listings');
    }

    const payment = await Payment.findOne({ stripeSessionId: sessionId }).populate('listing');
    if (!payment) {
      req.flash('error', 'Payment record not found');
      return res.redirect('/listings');
    }

    // mark paid and persist dates from metadata if somehow missing
    payment.status = 'paid';
    if (!payment.checkIn  && session.metadata.checkIn)  payment.checkIn  = new Date(session.metadata.checkIn);
    if (!payment.checkOut && session.metadata.checkOut) payment.checkOut = new Date(session.metadata.checkOut);
    if (!payment.nights   && session.metadata.nights)   payment.nights   = Number(session.metadata.nights);
    await payment.save();

    req.flash('success', 'Payment successful! Booking confirmed.');
    res.render('payments/success.ejs', { session, payment });
  } catch (err) {
    console.error('Stripe payment success error:', err);
    req.flash('error', 'Unable to verify payment successfully');
    return res.redirect('/listings');
  }
};

/**
 * GET /payments/history  (user)
 */
module.exports.userBookingHistory = async (req, res) => {
  try {
    const bookings = await Payment.find({ user: req.user._id, status: 'paid' })
      .populate({ path: 'listing', select: 'title location country price Owner' })
      .sort({ createdAt: -1 });

    res.render('payments/history.ejs', { bookings });
  } catch (err) {
    console.error('Booking history error:', err);
    req.flash('error', 'Unable to load your booking history.');
    res.redirect('/listings');
  }
};

/**
 * GET /listings/:id/bookings  (host)
 */
module.exports.hostBookingHistory = async (req, res) => {
  try {
    const listingId = req.params.id;
    const listing = await Listing.findOne({ _id: listingId, Owner: req.user._id });
    if (!listing) {
      req.flash('error', 'Listing not found or access denied.');
      return res.redirect('/listings/dashboard');
    }

    const bookings = await Payment.find({ listing: listingId, status: 'paid' })
      .populate({ path: 'user', select: 'username email' })
      .sort({ createdAt: -1 });

    res.render('listings/listingBookings.ejs', { bookings });
  } catch (err) {
    console.error('Host booking history error:', err);
    req.flash('error', 'Unable to load booking details.');
    res.redirect('/listings/dashboard');
  }
};

module.exports.paymentCancel = (req, res) => {
  req.flash('error', 'Payment canceled.');
  res.redirect('/listings');
};
