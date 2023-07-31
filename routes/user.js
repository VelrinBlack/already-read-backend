const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const { responseMessage } = require('../strings.json');
const randomstring = require('randomstring');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const { default: mongoose } = require('mongoose');
const multer = require('multer');
const fs = require('fs');
const { authorizate, isEmail } = require('../tools');

const upload = multer({ dest: 'images/' });
const router = express.Router();

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: responseMessage.INVALID_PARAMETERS });
  }

  if (name.length < 2 || !isEmail(email) || password.length < 5) {
    return res.status(400).json({ message: responseMessage.INVALID_PARAMETERS });
  }

  if (await User.findOne({ email }).exec()) {
    return res.status(400).json({ message: responseMessage.ALREADY_EXISTS });
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
    return res.status(500).json({ message: responseMessage.INTERNAL_SERVER_ERROR });
  }

  const token = jwt.sign({ name, email }, process.env.TOKEN_SECRET);

  return res.status(201).json({
    message: responseMessage.CREATED_SUCCESSFULLY,
    token,
    name,
    email,
  });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: responseMessage.INVALID_PARAMETERS });
  }

  const user = await User.findOne({ email }).exec();

  if (!user) {
    return res.status(400).json({ message: responseMessage.INVALID_CREDENTIALS });
  }

  if (!(await bcrypt.compare(password, user.password))) {
    return res.status(400).json({ message: responseMessage.INVALID_CREDENTIALS });
  }

  const token = jwt.sign({ name: user.name, email }, process.env.TOKEN_SECRET);

  return res.status(200).json({
    message: responseMessage.AUTHENTICATED_SUCCESSFULLY,
    token,
    name: user.name,
    email,
  });
});

router.patch('/update', authorizate, upload.single('profileImage'), async (req, res) => {
  if (req.file) {
    if (
      req.file.mimetype != 'image/png' &&
      req.file.mimetype != 'image/jpg' &&
      req.file.mimetype != 'image/jpeg' &&
      req.file.mimetype != 'image/webp'
    ) {
      fs.unlinkSync(`images/${req.file.filename}`);
      return res.status(400).json({ message: responseMessage.UNSUPPORTED_FILE_TYPE });
    }

    fs.rename(req.file.path, `${req.file.path}.png`, (err) => {
      if (err) {
        fs.unlinkSync(`images/${req.file.filename}`);
        return res.status(500).json({ message: responseMessage.INTERNAL_SERVER_ERROR });
      }
    });
  }

  const { newName, newEmail, oldPassword, newPassword } = req.body;

  if (!newName || !newEmail || !oldPassword || !newPassword) {
    fs.unlinkSync(`images/${req.file.filename}.png`);
    return res.status(400).json({ message: responseMessage.INVALID_PARAMETERS });
  }

  const user = await User.findOne({ email: req.user.email }).exec();

  if (!user || !(await bcrypt.compare(oldPassword, user?.password))) {
    fs.unlinkSync(`images/${req.file.filename}.png`);
    return res.status(400).json({ message: responseMessage.INVALID_CREDENTIALS });
  }

  if ((await User.findOne({ email: newEmail }).exec()) && req.user.email != newEmail) {
    fs.unlinkSync(`images/${req.file.filename}.png`);
    return res.status(400).json({ message: responseMessage.ALREADY_EXISTS });
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
    message: responseMessage.UPDATED_SUCCESSFULLY,
    token,
    newName,
    newEmail,
  });
});

router.get('/allFavourites', authorizate, async (req, res) => {
  const user = await User.findOne({ email: req.user.email }).exec();

  if (!user) {
    return res.status(400).json({ message: responseMessage.INVALID_CREDENTIALS });
  }

  await user.populate('favourites', '_id title ISBN price imageName condition');

  return res.status(200).json({ favourites: user.favourites });
});

router.post('/addFavourite', authorizate, async (req, res) => {
  const { bookID } = req.body;

  if (!bookID || bookID.length != 24) {
    return res.status(400).json({ message: responseMessage.INVALID_PARAMETERS });
  }

  const user = await User.findOne({ email: req.user.email }).exec();

  if (!user) {
    return res.status(400).json({ message: responseMessage.INVALID_CREDENTIALS });
  }

  if (user.favourites.find((id) => id == bookID)) {
    return res.status(400).json({ message: responseMessage.ALREADY_EXISTS });
  }

  user.favourites.push(mongoose.Types.ObjectId(bookID));
  user.save();

  return res.status(200).json({
    message: responseMessage.CREATED_SUCCESSFULLY,
  });
});

router.delete('/removeFavourite/:bookID', authorizate, async (req, res) => {
  const { bookID } = req.params;

  if (!bookID || bookID.length != 24) {
    return res.status(400).json({ message: responseMessage.INVALID_PARAMETERS });
  }

  const user = await User.findOne({ email: req.user.email }).exec();

  if (!user) {
    return res.status(400).json({ message: responseMessage.INVALID_CREDENTIALS });
  }

  if (!user.favourites.find((id) => id == bookID)) {
    return res.status(400).json({ message: responseMessage.INVALID_PARAMETERS });
  }

  user.favourites = user.favourites.filter((favourite) => favourite.toString() !== bookID);
  user.save();

  return res.status(200).json({
    message: responseMessage.REMOVED_SUCCESSFULLY,
  });
});

router.get('/checkIfFavourite', authorizate, async (req, res) => {
  const { bookID } = req.query;

  if (!bookID || bookID.length != 24) {
    return res.status(400).json({ message: responseMessage.INVALID_PARAMETERS });
  }

  const user = await User.findOne({ email: req.user.email }).exec();

  if (!user) {
    return res.status(400).json({ message: responseMessage.INVALID_CREDENTIALS });
  }

  if (user.favourites.find((id) => id == bookID)) {
    return res.status(200).json({ message: responseMessage.BOOK_IS_FAVOURITE });
  } else {
    return res.status(200).json({ message: responseMessage.BOOK_IS_NOT_FAVOURITE });
  }
});

router.get('/profileImage/:userEmail', async (req, res) => {
  const { userEmail } = req.params;

  if (!userEmail) {
    return res.status(400).json({ message: responseMessage.INVALID_PARAMETERS });
  }

  const user = await User.findOne({ email: userEmail }).exec();

  if (!user) {
    return res.status(400).json({ message: responseMessage.INVALID_CREDENTIALS });
  }

  if (user.profileImageName) {
    return res.download(`images/${user.profileImageName}`);
  } else {
    return res.status(404).json({ message: responseMessage.NOT_FOUND });
  }
});

router.get('/books/:userEmail', async (req, res) => {
  const { userEmail } = req.params;

  if (!userEmail) {
    return res.status(400).json({ message: responseMessage.INVALID_PARAMETERS });
  }

  const user = await User.findOne({ email: userEmail }).exec();

  if (!user) {
    return res.status(400).json({ message: responseMessage.INVALID_CREDENTIALS });
  }

  await user.populate('books', '_id title ISBN price imageName condition');

  return res.status(200).json({ books: user.books });
});

module.exports = router;
