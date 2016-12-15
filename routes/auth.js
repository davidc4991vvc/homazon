var express = require('express');
var router = express.Router();
var User = require('../models/user');
var constants = require('../constants');

module.exports = function(passport, mongoStore) {

  function restoreSession(req, res, next) {
    // Check for a saved session ID
    if (req.user.sessionId) {
      console.log("User has saved session ID: " + req.user.sessionId);
      mongoStore.get(req.user.sessionId, function(err, session) {
        if (err) console.error(err);
        if (session && session.cart) {
          console.log("Restoring cart from session:");
          console.log(session);

          // Just restore the cart
          req.session.cart = session.cart;

          // Save session ID to user object
          // We do this regardless of whether or not we restored a session
          User.findByIdAndUpdate(req.user._id, {sessionId: req.session.id}, function(err) {
            next(err);
          });
        }
      });
    } else {
      // Save session ID to user object
      // We do this regardless of whether or not we restored a session
      User.findByIdAndUpdate(req.user._id, {sessionId: req.session.id}, function(err) {
        next(err);
      });
    }
  }

  // GET Login page
  router.get('/login', function(req, res) {
    res.render('auth/login');
  });

  // POST Login page
  // Custom handler, to handle the verify case.
  router.post('/login', function(req, res, next) {
    passport.authenticate('local', function(err, user, info) {
      // User still needs to verify phone number
      if (info && info.code && info.code===constants.PLEASE_VERIFY)
        return res.redirect('/register/' + info.userId + '/confirm');

      if (err) { return next(err); }
      if (!user) { return res.redirect('/login'); }
      req.logIn(user, function(err) {
        if (err) { return next(err); }
        next();
      });
    })(req, res, next);
  }, restoreSession, function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/');
  });

  // GET Logout page
  router.get('/logout', function(req, res) {
    // Req.logout doesn't remove the session!
    req.logout();

    // We need this to remove the session so another user logging in
    // won't see the same session.
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });

  // FACEBOOK

  router.get('/auth/facebook',
    passport.authenticate('facebook'));

  router.get('/auth/facebook/callback',
    passport.authenticate('facebook', { failureRedirect: '/login' }),
    restoreSession,
    function(req, res) {
      // Successful authentication, redirect home.
      res.redirect('/');
    });

  return router;
};
