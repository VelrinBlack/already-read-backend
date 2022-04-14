const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  activated: {
    type: Boolean,
    default: false,
  },
  activationCode: {
    type: String,
    length: 6,
    required: true,
  },
});

const User = mongoose.model('User', userSchema);

module.exports = User;
