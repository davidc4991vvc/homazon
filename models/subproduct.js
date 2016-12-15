var mongoose = require('mongoose');
var utils = require('../utils');

var subproductSchema = mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  stock: {
    type: Number,
    required: true
  }
});
subproductSchema.virtual('displayPrice').get(function() {
  return utils.formatPrice(this.price);
});

module.exports = mongoose.model('Subproduct', subproductSchema);
