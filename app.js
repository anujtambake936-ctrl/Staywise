if(process.env.NODE_ENV!="production"){
require("dotenv").config();
}

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const ExpressError = require("./utils/ExpressError.js");
const sessions = require("express-session")
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");

const listingRouter = require("./routes/listing.js");
const reviewRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");

const MONGO_URL = process.env.DB_URL||"mongodb://127.0.0.1:27017/wanderlust";

main()
  .then(()=>{
     console.log("connected tO DB");
  })
  .catch((err)=>{
     console.log(err)
  })

  async function main(){
    await mongoose.connect(MONGO_URL);
  };

app.set("view engine","ejs");
app.set("views",path.join(__dirname,"views"));
app.use(express.urlencoded({extended:true}))
app.use(methodOverride("_method"));
app.engine("ejs",ejsMate);
app.use(express.static(path.join(__dirname,"/public")));

const sessionOptions={
   secret:process.env.SESSION_SECRET || "mysupersecretcode",
   resave:false,
   saveUninitialized:true,
   cookie:{
      expires:Date.now()+7*24*60*60*1000,
      maxAge:7*24*60*60*1000,
      httpOnly:true,
   },
}

// app.get("/",(req,res)=>{
//     res.send("Hi iam root");
// });

app.use(sessions(sessionOptions));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req,res,next)=>{
   res.locals.success=req.flash("success");
   res.locals.error=req.flash("error");
   res.locals.currUser=req.user;
   next();
});

app.use("/listings",listingRouter)
app.use("/listings/:id/reviews",reviewRouter)
app.use("/",userRouter);

app.all("/{*splat}", (req,res,next)=>{
    next(new ExpressError(404,"Page Not Found!"));
});

app.use((err, req, res, next) => {// Add this to see if it triggers
    let { statusCode = 500, message ="something went wrong" } = err;
   res.status(statusCode).render("error.ejs",{message} );
});

app.listen(8080,()=>{
   console.log("server is listening to the port 8080");
});