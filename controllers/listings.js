const Listing      = require('../models/listing.js');
const Payment      = require('../models/payment.js');
const mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');
const geocodingClient = mbxGeocoding({ accessToken: process.env.MAP_TOKEN });

function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

module.exports.index = async (req, res) => {
  const { search = '', category = 'All', minPrice = '', maxPrice = '', trending = '' } = req.query;
  const query = {};

  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    query.$or = [{ title: regex }, { location: regex }, { country: regex }];
  }

  if (category && category !== 'All') query.category = category;

  const priceFilter = {};
  if (minPrice) priceFilter.$gte = Number(minPrice);
  if (maxPrice) priceFilter.$lte = Number(maxPrice);
  if (Object.keys(priceFilter).length) query.price = priceFilter;

  if (trending === '1' || search.toLowerCase() === 'trending') {
    const pipeline = [
      { $match: query },
      { $lookup: { from: 'reviews', localField: 'reviews', foreignField: '_id', as: 'reviewsDocs' } },
      { $addFields: {
        avgRating:    { $ifNull: [{ $avg: '$reviewsDocs.rating' }, 0] },
        views:        { $ifNull: ['$views', 0] },
      }},
      { $addFields: {
        ageDays: { $divide: [{ $subtract: [new Date(), '$createdAt'] }, 1000 * 60 * 60 * 24] },
      }},
      { $addFields: {
        score: { $add: [
          { $multiply: ['$views', 0.6] },
          { $multiply: ['$avgRating', 2.0] },
          { $multiply: [{ $divide: [1, { $add: ['$ageDays', 1] }] }, 3.0] },
        ]},
      }},
      { $sort: { score: -1 } },
    ];
    const allListings = await Listing.aggregate(pipeline);
    return res.render('listings/index.ejs', { allListings, search: '', category, minPrice, maxPrice, trending: '1' });
  }

  const allListings = await Listing.find(query);
  res.render('listings/index.ejs', { allListings, search, category, minPrice, maxPrice, trending: '' });
};

module.exports.renderNewForm = (req, res) => res.render('listings/new.ejs');

module.exports.showListing = async (req, res) => {
  const listing = await Listing.findById(req.params.id)
    .populate({ path: 'reviews', populate: { path: 'author' } })
    .populate('Owner');

  if (!listing) {
    req.flash('error', 'Listing does not exist');
    return res.redirect('/listings');
  }

  listing.views = (listing.views || 0) + 1;
  await listing.save();

  res.render('listings/show.ejs', { listing });
};

module.exports.renderHostDashboard = async (req, res) => {
  const listings = await Listing.find({ Owner: req.user._id });
  const listingsWithCounts = await Promise.all(
    listings.map(async (listing) => {
      const bookingCount = await Payment.countDocuments({ listing: listing._id, status: 'paid' });
      return { listing, bookingCount };
    })
  );
  res.render('listings/dashboard.ejs', { listingsWithCounts });
};

module.exports.renderListingBookings = async (req, res) => {
  const listing = await Listing.findOne({ _id: req.params.id, Owner: req.user._id });
  if (!listing) {
    req.flash('error', 'Listing not found or access denied.');
    return res.redirect('/listings/dashboard');
  }
  const bookings = await Payment.find({ listing: req.params.id, status: 'paid' })
    .populate({ path: 'user', select: 'username email fullName' })
    .sort({ createdAt: -1 });
  res.render('listings/listingBookings.ejs', { listing, bookings });
};

module.exports.createListing = async (req, res) => {
  let geoResponse = null;
  try {
    geoResponse = await geocodingClient.forwardGeocode({ query: req.body.listing.location, limit: 1 }).send();
  } catch (err) {
    console.warn('Geocoding failed:', err);
  }

  try {
    const newListing  = new Listing(req.body.listing);
    newListing.Owner  = req.user._id;

    if (req.file?.path) {
      newListing.image = { url: req.file.path, filename: req.file.filename };
    } else if (req.body.listing?.image?.url) {
      newListing.image = { url: req.body.listing.image.url };
    }

    const features = geoResponse?.body?.features;
    newListing.geometry = features?.length && features[0].geometry
      ? features[0].geometry
      : { type: 'Point', coordinates: [0, 0] };

    if (!features?.length) req.flash('warning', 'Location could not be geocoded; saved with fallback coordinates.');

    await newListing.save();
    req.flash('success', 'New Listing Created');
    res.redirect('/listings');
  } catch (err) {
    console.error('Failed to create listing:', err);
    const listing = req.body.listing || {};
    if (req.file?.path) listing.image = { url: req.file.path, filename: req.file.filename };
    res.status(400).render('listings/new.ejs', { listing, error: err.message });
  }
};

module.exports.renderEditForm = async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing) {
    req.flash('error', 'Listing does not exist');
    return res.redirect('/listings');
  }
  const originalImageUrl = listing.image.url.replace('/upload', '/upload/h_300,w_250');
  res.render('listings/edit.ejs', { listing, originalImageUrl });
};

module.exports.updateListing = async (req, res) => {
  const { id } = req.params;
  const listing = await Listing.findByIdAndUpdate(id, { ...req.body.listing });
  if (req.file) {
    listing.image = { url: req.file.path, filename: req.file.filename };
    await listing.save();
  }
  req.flash('success', 'Listing Updated');
  res.redirect(`/listings/${id}`);
};

module.exports.destroyListing = async (req, res) => {
  await Listing.findByIdAndDelete(req.params.id);
  req.flash('success', 'Listing Deleted');
  res.redirect('/listings');
};
