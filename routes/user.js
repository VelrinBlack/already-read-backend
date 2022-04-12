const express = require('express');
const User = require('../models/User');
const { responseMessages } = require('../strings.json');

const router = express.Router();

const isEmail = (str) => {
  return str
    .toLowerCase()
    .match(
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
    );
};

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: responseMessages.invalidParameters });
  }

  if (name.length < 2 || !isEmail(email) || password.length < 5) {
    return res.status(400).json({ message: responseMessages.invalidParameters });
  }

  if (await User.findOne({ email }).exec()) {
    return res.status(400).json({ message: responseMessages.alreadyExists });
  }

  const user = new User({
    name,
    email,
    password,
  });

  await user.save();

  return res.status(201).json({ message: responseMessages.createdSuccessfully });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: responseMessages.invalidParameters });
  }

  const user = await User.findOne({ email }).exec();

  if (!user) {
    return res.status(400).json({ message: responseMessages.invalidCredentials });
  }

  if (password !== user.password) {
    return res.status(400).json({ message: responseMessages.invalidCredentials });
  }

  return res.status(200).json({ message: responseMessages.authenticatedSuccessfully });
});

module.exports = router;
