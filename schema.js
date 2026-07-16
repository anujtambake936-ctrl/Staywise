const Joi = require('joi');

module.exports.listingSchema=Joi.object({
    listing:Joi.object({
       title:Joi.string().required(),
       country:Joi.string().required(),
       location:Joi.string().required(),
       description:Joi.string().required(),
       price:Joi.number().required().min(0),
       category:Joi.string().valid("Apartment","Villa","Cottage","Beach House","Cabin").required(),
      // If the image is now an object (e.g., { url: string, filename: string }):
       image: Joi.object({
            url: Joi.string().allow("",null),
            filename: Joi.string().allow("",null)
            }).allow("", null)
        }).optional(),
    
});


module.exports.reviewSchema=Joi.object({
    review:Joi.object({
        rating:Joi.string().required().min(1).max(5),
        comment:Joi.string().required()
    }).required()
});