const express=require("express");
const router=express.Router();
const User = require("../models/user.js"); // Ensure the path to your models folder is correct
const wrapAsync=require("../utils/wrapAsync");
const passport=require("passport");
const { saveRedirectUrl } = require("../middleware.js");

const userController=require("../controllers/users.js");

router
  .route("/signup")
    .get(userController.renderSignUp)
    .post(wrapAsync(userController.signup));

router
   .route("/login")
       .get(userController.renderlogIn)
       .post(saveRedirectUrl,
          passport.authenticate("local",{
           failureRedirect:"/login",
          failureFlash:true}),
          userController.logIn);

router.get("/logout",userController.logOut);

module.exports=router;