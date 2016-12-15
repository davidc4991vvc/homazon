var mongoose = require('mongoose');
var userSchema = mongoose.Schema({
  username: String, // THIS IS A PHONE NUMBER!
  password: String,
  facebookId: {
    type: String,
    required: false
  }
});

module.exports = mongoose.model('User', userSchema);

// module.exports = {
//   User: mongoose.Model('User', userSchema)
// };
