// Put these in their own router since it's a bit complex.

var express = require('express');
var twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
var stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
var phone = require('phone');
var router = express.Router();
var twilioPhoneNumber = process.env.FROM_PHONE;
var
  User = require('../models/user'),
  Shipping = require('../models/shipping'),
  Payment = require('../models/payment');

// Utility functions
function randomCode() {
  var min = 1000;
  var max = 9999;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function phoneNumberToE164(number) {
  number = phone(number, 'USA');
  if (number.length>0)
    return number[0];
  return null;
}

function sendSms(phoneTo, body, callback) {
  // Twilio returns a promise, so we do too.
  twilio.sendMessage({
    to: phoneNumberToE164(phoneTo),
    from: phoneNumberToE164(twilioPhoneNumber),
    body: body
  }, callback);
}

// GET registration page
router.get('/register', function(req, res) {
  res.render('register/index');
});

// POST registration page
var validateReq = function(userData) {
  return (userData.username && userData.password && userData.email &&
    (userData.password === userData.passwordRepeat));
};

router.post('/register', function(req, res, next) {
  // validation step
  if (!validateReq(req.body)) {
    return res.render('register/index', {
      error: "Fields missing or passwords don't match",
      data: req.body
    });
  }

  // Don't create duplicate users
  User.findOne({"$or": [{username: req.body.username}, {email: req.body.email}]}, function(err, user) {
    if (err) return next(err);
    if (user)
      return res.render('register/index', {
        error: "This phone number or email address is already registered"
      });

    // Okay to create
    var code = randomCode();
    var u = new User({
      // username is phone number
      username: req.body.username,
      email: req.body.email,
      password: req.body.password,
      registrationCode: code
    });
    u.save(function(err, user) {
      if (err) {
        console.log(err);
        res.status(500).redirect('/register');
        return;
      }
      console.log("Created new user:");
      console.log(user);

      // Send verification code
      sendSms(
        req.body.username,
        "Your Homazon code is " + code,
        function(err, responseData) {
          if (err) return next(err);
          res.redirect('/register/' + user._id + '/confirm');
        }
      );
    });
  });
});

function verifyNumber(req, res, next) {
  User.findById(req.params.uid, function(err, user) {
    if (err) return next(err);
    if (!user) return next(new Error("Bad user ID"));

    // Accept code via GET or POST
    var code = req.params.code || req.body.code;

    if (code) {
      if (user.registrationCode===code) {
        // Successful validation of code
        user.registrationCode = "";
        user.save(function(err) {
          if (err) return next(err);
          // Log the user in
          req.login(user, function(err) {
            if (!err)
              // No need for a UID beyond this point since they're logged in.
              res.redirect('/register/shipping');
            else
              next(err);
          });
        })
      } else {
        return res.render('register/verify', {error: "Invalid code"});
      }
    } else {
      res.render('register/verify');
    }
  });
}

// Verify phone number
router.get('/register/:uid/confirm/:code?', verifyNumber);
router.post('/register/:uid/confirm', verifyNumber);

// Beyond this point the user must be logged in
// Note: code duplicated in shop.js
router.use(function(req, res, next) {
  if (!req.isAuthenticated())
    return res.redirect('/login');
  next();
});

// Step 2 of the registration process
router.get('/register/shipping', function(req, res) {
  res.render('register/shipping');
});

router.post('/register/shipping', function(req, res, next) {
  // Super basic validation for now--we could do many more complex,
  // sophisticated things here! With mongoose schemas, with libraries
  // that auto-render and re-render forms, etc.
  if (!(req.body.address1 && req.body.city && req.body.state && req.body.zip)) {
    return res.render('register/shipping', {
      error: "One or more required fields is missing",
      data: req.body
    });
  }

  var params = Object.assign(req.body, {parent: req.user._id});
  Shipping.create(params, function(err, shipping) {
    if (err) return next(err);
    // Update user object
    // This is the easiest way to do it in a single operation
    User.findByIdAndUpdate(req.user.id, {defaultShipping: shipping._id}, function(err) {
      if (err) return next(err);
      res.redirect('/register/payment');
    });
  });
});

// Step 3 of the registration process
router.get('/register/payment', function(req, res) {
  res.render('register/payment', {
    stripeKey: process.env.STRIPE_PUBLIC_KEY
  });
});

router.post('/register/payment', function(req, res, next) {
  // Stripe auto-populates our form for us
  if (!(req.body.stripeToken && req.body.stripeEmail)) {
    return res.render('register/shipping', {
      error: "One or more required fields is missing"
    });
  }

  // Create a Stripe customer using this token.
  stripe.customers.create({
    source: req.body.stripeToken,
    email: req.body.stripeEmail
  }, function(err, customer) {
    if (err) return next(err);

    // Save the customer data on our side.
    Payment.create({
      stripeCustomerId: customer.id,
      parent: req.user._id,
      stripeSource: customer.sources.data[0].id,
      stripeLast4: customer.sources.data[0].last4,
      stripeBrand: customer.sources.data[0].brand,
      stripeExpMonth: customer.sources.data[0].exp_month,
      stripeExpYear: customer.sources.data[0].exp_year
    }, function(err, payment) {
      if (err) return next(err);
      // Update user object
      // This is the easiest way to do it in a single operation
      User.findByIdAndUpdate(req.user.id, {defaultPayment: payment._id}, function(err) {
        if (err) return next(err);
        // Registration done!
        res.redirect('/');
      });
    });
  });
});

module.exports = router;
