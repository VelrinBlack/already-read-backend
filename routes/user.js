const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const { responseMessages } = require('../strings.json');
const randomstring = require('randomstring');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const { default: mongoose } = require('mongoose');
const multer = require('multer');
const fs = require('fs');

const upload = multer({ dest: 'images/' });
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

router.patch('/update', authorizate, upload.single('profileImage'), async (req, res) => {
  if (req.file) {
    fs.rename(req.file.path, `${req.file.path}.png`, (err) => {
      if (err) {
        fs.unlinkSync(`images/${req.file.path}`);
        return res.status(500).json({ message: responseMessages.internalServerError });
      }
    });

    if (
      req.file.mimetype != 'image/png' &&
      req.file.mimetype != 'image/jpg' &&
      req.file.mimetype != 'image/jpeg' &&
      req.file.mimetype != 'image/webp'
    ) {
      fs.unlinkSync(`images/${req.file.path}`);
      return res.status(400).json({ message: responseMessages.unsupportedFileType });
    }
  }

  const { newName, newEmail, oldPassword, newPassword } = req.body;

  if (!newName || !newEmail || !oldPassword || !newPassword) {
    return res.status(400).json({ message: responseMessages.invalidParameters });
  }

  const user = await User.findOne({ email: req.user.email }).exec();

  if (!user || !(await bcrypt.compare(oldPassword, user?.password))) {
    return res.status(400).json({ message: responseMessages.invalidCredentials });
  }

  if ((await User.findOne({ email: newEmail }).exec()) && req.user.email != newEmail) {
    return res.status(400).json({ message: responseMessages.alreadyExists });
  }

  if (req.file) {
    if (user.profileImageName) {
      fs.unlinkSync(`images/${user.profileImageName}`);
    }

    user.profileImageName = `${req.file.filename}.png`;
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
    newName,
    newEmail,
  });
});

router.get('/allFavourites', authorizate, async (req, res) => {
  const user = await User.findOne({ email: req.user.email }).exec();

  if (!user) {
    return res.status(400).json({ message: responseMessages.invalidCredentials });
  }

  await user.populate('favourites', '_id title ISBN price imageName condition');

  return res.status(200).json({ favourites: user.favourites });
});

router.post('/addFavourite', authorizate, async (req, res) => {
  const { bookID } = req.body;

  if (!bookID || bookID.length != 24) {
    return res.status(400).json({ message: responseMessages.invalidParameters });
  }

  const user = await User.findOne({ email: req.user.email }).exec();

  if (!user) {
    return res.status(400).json({ message: responseMessages.invalidCredentials });
  }

  if (user.favourites.find((id) => id == bookID)) {
    return res.status(400).json({ message: responseMessages.alreadyExists });
  }

  user.favourites.push(mongoose.Types.ObjectId(bookID));
  user.save();

  return res.status(200).json({
    message: responseMessages.createdSuccessfully,
  });
});

router.delete('/removeFavourite/:bookID', authorizate, async (req, res) => {
  const { bookID } = req.params;

  if (!bookID || bookID.length != 24) {
    return res.status(400).json({ message: responseMessages.invalidParameters });
  }

  const user = await User.findOne({ email: req.user.email }).exec();

  if (!user) {
    return res.status(400).json({ message: responseMessages.invalidCredentials });
  }

  if (!user.favourites.find((id) => id == bookID)) {
    return res.status(400).json({ message: responseMessages.invalidParameters });
  }

  user.favourites = user.favourites.filter((favourite) => favourite.toString() !== bookID);
  user.save();

  return res.status(200).json({
    message: responseMessages.removedSuccessfully,
  });
});

router.get('/checkIfFavourite', authorizate, async (req, res) => {
  const { bookID } = req.query;

  if (!bookID || bookID.length != 24) {
    return res.status(400).json({ message: responseMessages.invalidParameters });
  }

  const user = await User.findOne({ email: req.user.email }).exec();

  if (!user) {
    return res.status(400).json({ message: responseMessages.invalidCredentials });
  }

  if (user.favourites.find((id) => id == bookID)) {
    return res.status(200).json({ message: responseMessages.bookIsFavourite });
  } else {
    return res.status(200).json({ message: responseMessages.bookIsNotFavourite });
  }
});

module.exports = router;
