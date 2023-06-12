const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const { responseMessages } = require('../strings.json');
const randomstring = require('randomstring');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');

const router = express.Router();

const isEmail = (str) => {
  return str
    .toLowerCase()
    .match(
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
    );
};

const authorizate = (req, res, next) => {
  const token = req.headers['authorization'];

  if (!token) {
    return res.status(400).json({ message: responseMessages.invalidParameters });
  }

  jwt.verify(token, process.env.TOKEN_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: responseMessages.invalidAuthorizationToken });
    }

    req.user = user;

    next();
  });
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

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = new User({
    name,
    email,
    password: hashedPassword,
    activationCode: randomstring.generate(6),
  });

  await user.save();

  let transport = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_ADDRESS,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  const mailOptions = {
    from: `Already Read <${process.env.EMAIL_ADDRESS}>`,
    to: email,
    subject: "Here's your AlreadyRead account activation code!",
    text: `Welcome to AlreadyRead!\nHere's your activation code: ${user.activationCode}`,
  };

  let emailSendingError = false;

  transport.sendMail(mailOptions, (err) => {
    if (err) {
      emailSendingError = true;
    }
  });

  if (emailSendingError) {
    return res.status(500).json({ message: responseMessages.internalServerError });
  }

  const token = jwt.sign({ name, email }, process.env.TOKEN_SECRET);

  return res.status(201).json({
    message: responseMessages.createdSuccessfully,
    token,
    name,
    email,
  });
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

  if (!(await bcrypt.compare(password, user.password))) {
    return res.status(400).json({ message: responseMessages.invalidCredentials });
  }

  const token = jwt.sign({ name: user.name, email }, process.env.TOKEN_SECRET);

  return res.status(200).json({
    message: responseMessages.authenticatedSuccessfully,
    token,
    name: user.name,
    email,
  });
});

router.patch('/update', authorizate, async (req, res) => {
  const { newName, newEmail, newPassword } = req.body;

  if (!newName || !newEmail || !newPassword) {
    return res.status(400).json({ message: responseMessages.invalidParameters });
  }

  const user = await User.findOne({ email: req.user.email }).exec();

  if (!user) {
    return res.status(400).json({ message: responseMessages.invalidCredentials });
  }

  if (newName != user.name) user.name = newName;
  if (newEmail != user.email) user.email = newEmail;
  if (!(await bcrypt.compare(newPassword, user.password)))
    user.password = await bcrypt.hash(newPassword, 10);

  await user.save();

  const token = jwt.sign({ name: user.name, email: user.email }, process.env.TOKEN_SECRET);

  return res.status(200).json({
    message: responseMessages.updatedSuccessfully,
    token,
  });
});

module.exports = router;
