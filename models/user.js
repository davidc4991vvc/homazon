var mongoose = require('mongoose');
var findOrCreate = require('mongoose-findorcreate');

var userSchema = mongoose.Schema({
  // We require one of (but not both of) username/password or facebookId
  // Unclear how to check this with a Mongoose validator so we don't =\
  username: String,
  email: String,
  password: String,
  facebookId: String,
  registrationCode: String,
  sessionId: String,

  // We link these in both directions: from user to shipping/payment and
  // from shipping/payment to user.
  defaultShipping: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shipping'
  },
  defaultPayment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment'
  },
  isAdmin: {
    type: Boolean,
    default: true
  }
});
userSchema.plugin(findOrCreate);

module.exports = mongoose.model('User', userSchema);
