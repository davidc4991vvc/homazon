var mongoose = require('mongoose');

var shippingSchema = mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  address1: {
    type: String,
    required: true
  },
  address2: String,
  city: {
    type: String,
    required: true
  },
  state: {
    type: String,
    required: true
  },
  zip: {
    type: String,
    required: true
  },
  phone: String,
  status: {
    type: Number,
    default: 100
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
});

module.exports = mongoose.model('Shipping', shippingSchema);
