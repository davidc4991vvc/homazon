var mongoose = require('mongoose');

var paymentSchema = mongoose.Schema({
  stripeBrand: String,
  stripeCustomerId: String,
  stripeExpMonth: Number,
  stripeExpYear: Number,
  stripeLast4: Number,
  stripeSource: {
    type: String,
    required: true
  },
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

module.exports = mongoose.model('Payment', paymentSchema);
