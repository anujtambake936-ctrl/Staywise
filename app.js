// MUST BE AT THE VERY TOP OF APP.JS
const dns = require("node:dns");
dns.setServers(["1.1.1.1", "8.8.8.8"]); // Overrides local system DNS for Node.js

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const express      = require('express');
const app          = express();
const mongoose     = require('mongoose');
const path         = require('path');
const methodOverride = require('method-override');
const ejsMate      = require('ejs-mate');
const ExpressError = require('./utils/ExpressError.js');
const sessions     = require('express-session');
const flash        = require('connect-flash');
const passport     = require('passport');
const LocalStrategy = require('passport-local');
const User         = require('./models/user.js');

const listingRouter = require('./routes/listing.js');
const reviewRouter  = require('./routes/review.js');
const userRouter    = require('./routes/user.js');
const paymentRouter = require('./routes/payments.js');
const chatRouter    = require('./routes/chat.js');

const MONGO_URL = process.env.DB_URL ||"mongodb://127.0.0.1:27017/staywise";

mongoose.connect(MONGO_URL)
  .then(() => console.log('Connected to DB'))
  .catch(err => console.error(err));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.engine('ejs', ejsMate);
app.use(express.static(path.join(__dirname, 'public')));

const sessionOptions = {
  secret: process.env.SESSION_SECRET || 'mysupersecretcode',
  resave: false,
  saveUninitialized: true,
  cookie: {
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    maxAge:  7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
  },
};

app.use(sessions(sessionOptions));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
  res.locals.success  = req.flash('success');
  res.locals.error    = req.flash('error');
  res.locals.currUser = req.user;
  next();
});

app.get('/', (req, res) => res.render('landing'));
app.use('/listings', listingRouter);
app.use('/listings/:id/reviews', reviewRouter);
app.use('/payments', paymentRouter);
app.use('/chat', chatRouter);
app.use('/', userRouter);

app.all(/.*/, (req, res, next) => next(new ExpressError(404, 'Page Not Found!')));

app.use((err, req, res, next) => {
  const { statusCode = 500, message = 'Something went wrong' } = err;
  res.status(statusCode).render('error.ejs', { message });
});

app.listen(8080, () => console.log('Server listening on port 8080'));
