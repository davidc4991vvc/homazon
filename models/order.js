var mongoose = require('mongoose');
var Subproduct = require('./subproduct');

var orderSchema = mongoose.Schema({
  // Store a list of subproducts embedded in the order
  contents: [mongoose.Schema.Types.Mixed],
  placed: {
    type: Date,
    default: Date.now,
    required: true
  },
  status: {
    type: Number,
    default: 100,
    required: true
  },
  chargeSubtotal: {
    type: Number,
    required: true
  },
  chargeTax: {
    type: Number,
    default: 0
  },
  chargeShipping: {
    type: Number,
    default: 0
  },
  chargeTotal: {
    type: Number,
    required: true
  },
  shipping: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shipping',
    required: true
  },
  payment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    required: true
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
});

module.exports = mongoose.model('Order', orderSchema);
