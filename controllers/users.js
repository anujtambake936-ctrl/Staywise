const User = require('../models/user.js');

module.exports.renderSignUp = (req, res) => res.render('users/signup.ejs');

module.exports.signup = async (req, res, next) => {
  try {
    const { username, email, password, fullName, phone, address, role, hostInfo } = req.body;
    const newUser = new User({
      username, email, fullName, phone, address, role,
      hostInfo: role === 'host' ? hostInfo : undefined,
    });
    const registeredUser = await User.register(newUser, password);
    req.login(registeredUser, (err) => {
      if (err) return next(err);
      req.flash('success', 'Welcome to Staywise!');
      res.redirect('/listings');
    });
  } catch (e) {
    req.flash('error', e.message);
    res.redirect('/signup');
  }
};

module.exports.renderlogIn = (req, res) => res.render('users/login.ejs');

module.exports.logIn = (req, res) => {
  req.flash('success', 'Welcome to Staywise! You are logged in.');
  const redirectUrl = res.locals.redirectUrl || '/listings';
  res.redirect(redirectUrl);
};

module.exports.logOut = (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.flash('success', 'You are logged out!');
    res.redirect('/listings');
  });
};
