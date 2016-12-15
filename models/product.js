var mongoose = require('mongoose');

var productSchema = mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: String,
  imageUri: String
});

module.exports = mongoose.model('Product', productSchema);
