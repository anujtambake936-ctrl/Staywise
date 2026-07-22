const Listing      = require('./models/listing.js');
const Review       = require('./models/review.js');
const ExpressError = require('./utils/ExpressError.js');
const { listingSchema, reviewSchema } = require('./schema.js');

module.exports.isLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) {
    const wantsJson = req.xhr
      || req.headers.accept?.includes('application/json')
      || req.get('Content-Type')?.includes('application/json')
      || req.originalUrl.startsWith('/payments');
    if (wantsJson) return res.status(401).json({ error: 'Authentication required' });
    req.session.redirectUrl = req.originalUrl;
    req.flash('error', 'You must be logged in to continue');
    return res.redirect('/login');
  }
  next();
};

module.exports.saveRedirectUrl = (req, res, next) => {
  if (req.session.redirectUrl) res.locals.redirectUrl = req.session.redirectUrl;
  next();
};

module.exports.isOwner = async (req, res, next) => {
  const { id } = req.params;
  const listing = await Listing.findById(id);
  if (!listing.Owner.equals(res.locals.currUser._id)) {
    req.flash('error', 'You do not have permission to edit');
    return res.redirect(`/listings/${id}`);
  }
  next();
};

module.exports.validateListing = (req, res, next) => {
  const { error } = listingSchema.validate(req.body);
  if (error) {
    const errMsg = error.details.map(el => el.message).join(', ');
    if (req.method === 'POST') {
      return res.status(400).render('listings/new.ejs', { listing: req.body.listing || {}, error: errMsg });
    }
    if (req.method === 'PUT') {
      const listing = { ...(req.body.listing || {}), _id: req.params.id };
      return res.status(400).render('listings/edit.ejs', { listing, originalImageUrl: req.body.listing?.image?.url || '', error: errMsg });
    }
    throw new ExpressError(400, errMsg);
  }
  next();
};

module.exports.validateReview = (req, res, next) => {
  const { error } = reviewSchema.validate(req.body);
  if (error) {
    const errMsg = error.details.map(el => el.message).join(', ');
    throw new ExpressError(400, errMsg);
  }
  next();
};

module.exports.isReviewAuthor = async (req, res, next) => {
  const { id, reviewId } = req.params;
  const review = await Review.findById(reviewId);
  if (!review.author.equals(res.locals.currUser._id)) {
    req.flash('error', 'You do not have permission to delete this review');
    return res.redirect(`/listings/${id}`);
  }
  next();
};

module.exports.isHost = (req, res, next) => {
  if (!req.isAuthenticated() || req.user.role !== 'host') {
    req.flash('error', 'Host access only');
    return res.redirect('/listings');
  }
  next();
};
