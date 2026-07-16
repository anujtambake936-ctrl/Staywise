const Listing=require("../models/listing.js");
const mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');
const mapToken=process.env.MAP_TOKEN;
const geocodingClient = mbxGeocoding({ accessToken: mapToken });



function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

module.exports.index=(async (req,res)=>{
  const { search = "", category = "All", minPrice = "", maxPrice = "" } = req.query;
  const query = {};
   const { trending = "" } = req.query;

  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    query.$or = [
      { title: regex },
      { location: regex },
      { country: regex }
    ];
  }

  if (category && category !== "All") {
    query.category = category;
  }

  const priceFilter = {};
  if (minPrice) priceFilter.$gte = Number(minPrice);
  if (maxPrice) priceFilter.$lte = Number(maxPrice);
  if (Object.keys(priceFilter).length) {
    query.price = priceFilter;
  }
   // If trending requested, compute a hybrid score (views, average rating, recency)
   if (trending === '1' || (search && search.toLowerCase() === 'trending')) {
      // aggregation pipeline: match filters, lookup reviews, compute avg rating, recency score and hybrid score
      const pipeline = [
         { $match: query },
         { $lookup: { from: 'reviews', localField: 'reviews', foreignField: '_id', as: 'reviewsDocs' } },
         { $addFields: {
               avgRating: { $ifNull: [{ $avg: '$reviewsDocs.rating' }, 0] },
               views: { $ifNull: ['$views', 0] },
               createdAt: '$createdAt'
         } },
         { $addFields: {
               ageDays: { $divide: [{ $subtract: [new Date(), '$createdAt'] }, 1000 * 60 * 60 * 24] }
         } },
         { $addFields: {
               recencyScore: { $divide: [1, { $add: ['$ageDays', 1] }] }
         } },
         { $addFields: {
               // weights: views 0.6, avgRating 2.0, recency 3.0 (adjustable)
               score: { $add: [ { $multiply: ['$views', 0.6] }, { $multiply: ['$avgRating', 2.0] }, { $multiply: ['$recencyScore', 3.0] } ] }
         } },
         { $sort: { score: -1 } }
      ];
      const allListings = await Listing.aggregate(pipeline);
      return res.render("listings/index.ejs",{ allListings, search: '', category, minPrice, maxPrice, trending: '1' });
   }

  const allListings = await Listing.find(query);
  res.render("listings/index.ejs",{ allListings, search, category, minPrice, maxPrice });
});

module.exports.renderNewForm=(req,res)=>{
     res.render("listings/new.ejs");
};

module.exports.showListing=(async(req,res)=>{
   let { id }=req.params;
   const listing= await Listing.findById(id).populate({
      path:"reviews",
   populate:{
      path:"author",
   },
})
.populate("Owner");
      try {
        listing.views = (listing.views || 0) + 1;
        await listing.save();
      } catch (err) {
        console.error('Failed to increment listing views', err);
      }
   if(!listing){
      req.flash("error"," Listing requested deos not exist");
      return res.redirect("/listings");
   }
   res.render("listings/show.ejs",{ listing });
});

module.exports.createListing=(async (req, res,next) => {
   try {
      let response = {};
      try {
         response = await geocodingClient.forwardGeocode({
            query: req.body.listing.location,
            limit: 1,
         }).send();
      } catch (err) {
         console.warn('Geocoding failed:', err);
         response = null;
      }

      // Build listing object safely
      const newListing = new Listing(req.body.listing);
      newListing.Owner = req.user._id;

      // Handle uploaded file if present
      if (req.file && req.file.path) {
         newListing.image = { url: req.file.path, filename: req.file.filename };
      } else if (req.body.listing && req.body.listing.image && req.body.listing.image.url) {
         newListing.image = { url: req.body.listing.image.url };
      }

      // Attach geometry if geocoding returned a valid feature, otherwise set a safe fallback
      if (response && response.body && Array.isArray(response.body.features) && response.body.features.length > 0 && response.body.features[0].geometry) {
         newListing.geometry = response.body.features[0].geometry;
      } else {
         // Fallback: mark as Point at (0,0) so validation passes — optionally notify user
         newListing.geometry = { type: 'Point', coordinates: [0, 0] };
         req.flash('warning', 'Location could not be geocoded; saved with fallback coordinates.');
      }

      const savedListing = await newListing.save();
      req.flash("success","New Listing Created");
      res.redirect("/listings");
   } catch (err) {
      // If validation or save fails, render the new form with the submitted data and error
      console.error('Failed to create listing:', err);
      const listing = req.body.listing || {};
      // preserve uploaded image url when possible
      if (req.file && req.file.path) {
         listing.image = { url: req.file.path, filename: req.file.filename };
      }
      res.status(400).render('listings/new.ejs', { listing, error: err.message });
   }
});

module.exports.renderEditForm=(async (req,res)=>{
   let { id }=req.params;
   const listing= await Listing.findById(id);
    if(!listing){
      req.flash("error"," Listing requested deos not exist");
      return res.redirect("/listings");
   }
   let originalImageUrl = listing.image.url;
    originalImageUrl = originalImageUrl.replace("/upload", "/upload/h_300,w_250"); // Resize to 300px width
   res.render("listings/edit.ejs",{ listing ,originalImageUrl});
});

module.exports.updateListing=(async (req,res)=>{
   let { id }=req.params;
   let listing= await Listing.findByIdAndUpdate(id,{...req.body.listing});
   
   if(typeof req.file!=="undefined"){
   let url=req.file.path;
   let filename=req.file.filename;
   listing.image={url,filename};
   await listing.save();
   }
   req.flash("success","Listing Updated");
    res.redirect(`/listings/${id}`);
   });


module.exports.destroyListing=(async (req,res)=>{
   let { id }=req.params;
   let deletedListing = await Listing.findByIdAndDelete(id);
   req.flash("success","Listing Deleted");
   res.redirect("/listings");
})