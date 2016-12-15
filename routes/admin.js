var express = require('express');
var mongoose = require('mongoose');
var router = express.Router();

var
  Product = require('../models/product'),
  Subproduct = require('../models/subproduct'),
  Order = require('../models/order'),
  User = require('../models/user');

// Everything after this point requires admin auth.
router.use(function(req, res, next) {
  if (!req.user.isAdmin)
    return res.redirect('/');
  next();
});

router.get('/orders', function(req, res, next) {
  Order.find(function(err, orders) {
    if (err) return next(err);
    res.render('admin/orders', {orders: orders});
  });
});

router.get('/users', function(req, res, next) {
  User.find(function(err, users) {
    if (err) return next(err);
    res.render('admin/users', {users: users});
  });
});

router.get('/', function(req, res, next) {
  res.redirect('/admin/products');
});

router.get('/products', function(req, res, next) {
  Product.find(function(err, products) {
    if (err) return next(err);
    res.render('admin/products', {products: products});
  });
});

router.get('/product/:pid?', function(req, res, next) {
  Product.findById(req.params.pid, function(err, product) {
    if (err) return next(err);

    // NOTE: Could store these inside Product model instead.
    Subproduct.find({parent: req.params.pid}, function(err, subproducts) {
      if (err) return next(err);
      res.render('admin/editproduct', {product: product, subproducts: subproducts});
    });
  });
});

router.post('/product/:pid?', function(req, res, next) {
  if (!(req.body.title &&
    req.body.description &&
    req.body.imageUri)) {
    return next(new Error("Missing required field"));
  }

  // Pass req.body here since the form field names perfectly match the
  // names in the Product model.
  // Upsert = update or insert (if it doesn't already exist)
  var pid = req.params.pid ? req.params.pid : new mongoose.Types.ObjectId();
  Product.update({_id: pid}, req.body, {upsert: true}, function(err) {
    if (err) return next(err);
    // TODO: add flash
    res.redirect('/admin/products');
  });
});

function getProductAndSubproduct(req, res, next) {
  Product.findById(req.params.pid, function(err, product) {
    if (err) return next(err);
    if (!product) return next(new Error("Bad product ID"));
    req.product = product;
    Subproduct.findById(req.params.sid, function(err, subproduct) {
      if (err) return next(err);
      req.subproduct = subproduct;
      next();
    });
  });
}

router.get('/product/delete/:pid', function(req, res, next) {
  Product.findByIdAndRemove(req.params.pid, function(err) {
    if (err) return next(err);
    res.redirect('/admin/products');
  });
});

router.get('/product/:pid/subproduct/delete/:sid', getProductAndSubproduct, function(req, res, next) {
  Subproduct.findByIdAndRemove(req.params.sid, function(err) {
    if (err) return next(err);
    res.redirect('/admin/product/' + req.params.pid);
  });
});

router.get('/product/:pid/subproduct/:sid?', getProductAndSubproduct, function(req, res, next) {
  res.render('admin/editsubproduct', {
    product: req.product,
    subproduct: req.subproduct
  });
});

router.post('/product/:pid/subproduct/:sid?', getProductAndSubproduct, function(req, res, next) {
  if (!(req.body.title && req.body.price && req.body.stock)) {
    return next(new Error("Missing required field"));
  }

  // Upsert = update or insert (if it doesn't already exist)
  var sid = req.subproduct ? req.subproduct._id : new mongoose.Types.ObjectId();
  var params = {
    title: req.body.title,
    price: req.body.price,
    parent: req.product._id,
    stock: req.body.stock
  };
  Subproduct.update({_id: sid}, params, {upsert: true}, function(err) {
    if (err) return next(err);
    // TODO: add flash
    res.redirect('/admin/product/' + req.product._id);
  });
});

module.exports = router;
