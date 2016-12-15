var express = require('express');
var mongoose = require('mongoose');
var router = express.Router();
var
  Product = require('../models/product'),
  Subproduct = require('../models/subproduct'),
  Order = require('../models/order');
var utils = require('../utils');

// Helper functions

function countItems(cart) {
  return cart.reduce(function(a, b) {
    return a + b.quantity;
  }, 0);
}

function totalItems(cart) {
  return cart.reduce(function(a, b) {
    return a + (b.quantity*b.subproduct.price);
  }, 0);
}

// Everything after this point requires auth and full registration.
router.use(function(req, res, next) {
  if (!req.isAuthenticated())
    return res.redirect('/login');

  // Check if the user has finished registration (shipping, payment)
  // TODO: add flash
  if (!req.user.defaultShipping)
    res.redirect('/register/shipping');
  else if (!req.user.defaultPayment)
    res.redirect('/register/payment');
  else
    next();
});

// Initialize the shopping cart
router.use(function(req, res, next) {
  if (!req.session)
    return next(new Error("Session error"));

  req.session.cart = req.session.cart || [];
  next();
});

// Get the product
function getProduct(req, res, next) {
  Product.findById(req.params.pid, function(err, product) {
    if (err) return next(err);
    if (!product) return next(new Error("Bad product ID"));
    req.product = product;

    // Get the subproducts for this product too.
    // Note: we could choose to store these inside the Product model,
    // making this query easier.
    Subproduct.find({parent: req.params.pid}, function(err, subproducts) {
      if (err) return next(err);
      req.subproducts = subproducts;
      next();
    });
  });
}

function getSubproduct(req, res, next) {
  Subproduct.findById(req.params.sid, function(err, subproduct) {
    if (err) return next(err);
    if (!subproduct) return next(new Error("Bad subproduct ID"));
    req.subproduct = subproduct;
    next();
  });
}

/* GET home page. */
router.get('/', function(req, res, next) {
  Product.find(function(err, products) {
    if (err) return next(err);
    res.render('shop/index', {
      title: 'Homazon',
      isAdmin: req.user.isAdmin,
      products: products,
      cart: req.session.cart,
      count: countItems(req.session.cart)
    });
  });
});

router.get('/product/:pid', getProduct, function(req, res, next) {
  // Update subproduct quantities based on cart--prevents the user from
  // adding more items to the cart than there are left in stock.
  req.session.cart.forEach(function(el) {
    req.subproducts.find(function(el2) {
      if (el2._id.equals(el.subproduct._id)) {
        el2.stock -= el.quantity;
        el2.inCart = el.quantity;
        return true;
      }
    });
  });

  res.render('shop/product', {
    product: req.product,
    subproducts: req.subproducts,
    cart: req.session.cart,
    count: countItems(req.session.cart)
  });
});

// Cart
// These should be POST, DELETE etc. but browser forms no longer support
// this--keep it simple and just use GET with verbs.
router.get('/cart/add/:sid', getSubproduct, function(req, res, next) {
  // PID has already been validated
  var i = req.session.cart.findIndex(function(val) {
    return req.subproduct._id.equals(val.subproduct._id);
  });

  /**
   * We add actual subproducts to the cart, rather than just their ID.
   * This saves a lookup operation later; it also protects us from the
   * situation where the price changes after the item is added to the
   * cart, but before the user checks out.
   *
   * However this presents a challenge: the object will be "flattened"
   * (i.e., converted from a fully-fledged Mongoose document to a plain
   * JS object) when it's serialized into the session. Pre-empt that by
   * doing it ourselves here, which allows us to tweak it--in particular
   * adding back the virtual value which we might otherwise lose.
   *
   * There's probably some good third-party library out there for
   * "flattening" Mongoose documents but our needs are pretty simple
   * so let's roll it ourselves.
   */
  req.subproduct = Object.assign(
    req.subproduct.toObject(),
    // Add back the virtual.
    {displayPrice: req.subproduct.displayPrice});

  if (i > -1)
    // Already exists, update it
    req.session.cart[i].quantity++;
  else
    // Add a new item
    req.session.cart.push({subproduct: req.subproduct, quantity: 1});

  // TODO: add flash
  res.redirect('/product/' + req.subproduct.parent);
});

router.get('/cart/delete', function(req, res, next) {
  req.session.cart = [];
  res.redirect('/');
});

router.get('/cart/delete/:sid', getSubproduct, function(req, res, next) {
  var deleter = function(val, i) {
    if (req.subproduct._id.equals(val.subproduct._id)) {
      console.log("Removing subproduct " + val.subproduct._id + " from cart");
      req.session.cart.splice(i, 1);
      // Stops iteration
      return true;
    }
    return false;
  };

  // PID has already been validated
  if (!req.session.cart.some(deleter))
    // Print error but don't show it to the user
    // TODO: add flash
    console.error("Failed to delete subproduct " + req.subproduct._id + " from cart");
  res.redirect('/cart');
});

router.get('/cart', function(req, res, next) {
  // "Populate" the cart with products
  var cart = [];
  try {
    req.session.cart.forEach(function (el) {
      Product.findById(el.subproduct.parent, function (err, product) {
        if (err) {
          console.error(err);
          throw err;
        }

        cart.push({
          quantity: el.quantity,
          subproduct: Object.assign({}, el.subproduct, {parent: product})
        });
        if (cart.length === req.session.cart.length) {
          res.render('shop/cart', {
            cart: cart,
            count: countItems(req.session.cart),
            total: utils.formatPrice(totalItems(req.session.cart))
          });
        }
      })
    });
  } catch (err) {
    next(err);
  }
});

/**
 * There are concurrency issues here in checkout, if a user has an item
 * in their cart but the stock changed since they were added to the
 * cart. We need to check if we can "get" the number of units in the
 * cart by decrementing the stock of each subproduct, and checking if
 * it went below zero--in which case the desired units is greater than
 * the current stock amount. In this case, we roll back (re-increment)
 * the stock of the items we tried to purchase and notify the user of
 * the error.
 */
router.get('/checkout', function(req, res, next) {
  // Make sure we have a cart or we'll get an error.
  if (!req.session.cart || !req.session.cart.length)
    return next(new Error("Empty cart"));

  // For each item, update the quantity atomically.
  var i = 0, updated = [], error = null;
  req.session.cart.forEach(function(el) {
    Subproduct.findByIdAndUpdate(
      el.subproduct._id,
      {$inc: {stock: -el.quantity}},
      {new: true},
      function(err, subproduct) {
      if (err) {
        console.error(err);
        error = err;

        // Don't push to updated, transaction didn't finish.
      }
      else {
        // We failed to get the desired quantity, roll back.
        if (subproduct.stock < 0) {
          error = new Error("Desired stock no longer available, please adjust your order");
        }

        // Transaction finished, push to updated.
        updated.push(el);
      }

      // Only runs once all have completed
      if (++i===req.session.cart.length) {
        // If any failed, roll back all
        if (error) {
          var error2 = null, j = 0;
          updated.forEach(function(el2) {
            Subproduct.findByIdAndUpdate(el2.subproduct._id, {$inc: {stock: el2.quantity}}, function(err2) {
              if (err2) {
                console.error(err2);
                error2 = err2;
              }
              if (++j===updated.length) {
                // all done
                // We only get to return a single error to the user,
                // although several may have occurred here. That's why
                // we console.error them all above.
                next(error2 || error);
              }
            });
          })
        } else {
          // All succeeded, create the order
          Order.create({
            chargeSubtotal: totalItems(req.session.cart),
            chargeTotal: totalItems(req.session.cart),
            // Linking these inside the User schema makes this easy.
            shipping: req.user.defaultShipping,
            payment: req.user.defaultPayment,
            contents: req.session.cart,
            parent: req.user._id
          }, function (err2, order) {
            if (err2) return next(err2);

            // Empty the cart
            req.session.cart = [];

            // Display thanks
            res.render('shop/confirm', {orderId: order._id});
          });
        }
      }
    });
  });
});

module.exports = router;
