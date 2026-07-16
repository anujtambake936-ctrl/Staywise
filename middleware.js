const Listing=require("./models/listing.js");
const Review=require("./models/review.js");
const ExpressError=require("./utils/ExpressError.js");
const { listingSchema,reviewSchema}=require("./schema.js");


module.exports.isLoggedIn=(req,res,next)=>{
    if (!req.isAuthenticated()){
        req.session.redirectUrl=req.originalUrl;
        req.flash("error","you must be logged in to create listing");
        return res.redirect("/login");
    }
    next();
}

module.exports.saveRedirectUrl=(req,res,next)=>{
    if(req.session.redirectUrl){
        res.locals.redirectUrl=req.session.redirectUrl;
    }
    next();
};

module.exports.isOwner=async(req,res,next)=>{
   let { id } = req.params;
    let listing=await Listing.findById(id);
        if(!listing.Owner.equals(res.locals.currUser._id)){
          req.flash("error","You dont have permission to edit");
          return res.redirect(`/listings/${id}`);
        }
        next();
}

module.exports.validateListing=(req,res,next)=>{
   const {error}=listingSchema.validate(req.body)
  
   if(error){
     const errMsg = error.details.map((el) => el.message).join(", ");
     if(req.method === "POST"){
       return res.status(400).render("listings/new.ejs", { listing: req.body.listing || {}, error: errMsg });
     }
     if(req.method === "PUT"){
       const listing = { ...(req.body.listing || {}), _id: req.params.id };
       return res.status(400).render("listings/edit.ejs", { listing, originalImageUrl: req.body.listing?.image?.url || "", error: errMsg });
     }
      throw new ExpressError(400, errMsg)
   }else{
      next();
   }
}

module.exports.validateReview=(req,res,next)=>{
   let {error}=reviewSchema.validate(req.body)
  
   if(error){
      let errMsg=error.details.map((el=>(el.message).join(",")));
      throw new ExpressError(400,error)
   }else{
      next();
   }
}

module.exports.isReviewAuthor=async(req,res,next)=>{
   let { id,reviewId } = req.params;
    let review=await Review.findById(reviewId);
        if(!review.author.equals(res.locals.currUser._id)){
          req.flash("error","You dont have permission as you are not the author");
          return res.redirect(`/listings/${id}`);
        }
        next();
}