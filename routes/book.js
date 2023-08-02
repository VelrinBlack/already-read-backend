const express = require('express');
const Book = require('../models/Book');
const { responseMessage } = require('../strings.json');
const { authorizate } = require('../tools');
const multer = require('multer');
const fs = require('fs');
const isbn3 = require('isbn3');

const upload = multer({ dest: 'images/' });
const router = express.Router();

router.get('/getFiltered', async (req, res) => {
  const { title, isbn } = req.query;

  if (title || isbn) {
    if (title && isbn) {
      let books = await Book.find();

      let booksByTitle = books.filter((book) => book.title.toLowerCase() === title.toLowerCase());
      let booksByISBN;

      if (booksByTitle.length) {
        return res.status(200).json({ books: booksByTitle });
      } else {
        booksByISBN = await Book.find({ ISBN: isbn });

        if (booksByISBN.length) {
          return res.status(200).json({ books: booksByISBN });
        } else {
          return res.status(404).json({ message: responseMessage.NOT_FOUND });
        }
      }
    } else if (title) {
      let books = await Book.find();
      books = books.filter((book) => book.title.toLowerCase() === title.toLowerCase());
      if (!books.length) return res.status(404).json({ message: responseMessage.NOT_FOUND });
      return res.status(200).json({ books });
    } else {
      let books = await Book.find({ ISBN: isbn });
      if (!books.length) return res.status(404).json({ message: responseMessage.NOT_FOUND });
      return res.status(200).json({ books });
    }
  } else {
    return res.status(400).json({ message: responseMessage.INVALID_PARAMETERS });
  }
});

router.get('/getOne', async (req, res) => {
  const { id } = req.query;

  if (id) {
    let error = false;

    const book = await Book.findOne({ _id: id })
      .populate('seller', 'name email')
      .catch(() => {
        error = true;
      });

    if (error) {
      return res.status(404).json({ message: responseMessage.NOT_FOUND });
    }

    if (book) {
      return res.status(200).json({
        book: {
          title: book.title,
          ISBN: book.ISBN,
          price: book.price,
          condition: book.condition,
          imageName: book.imageName,
          seller: book.seller,
          description: book.description,
        },
      });
    } else {
      return res.status(404).json({ message: responseMessage.NOT_FOUND });
    }
  } else {
    return res.status(400).json({ message: responseMessage.INVALID_PARAMETERS });
  }
});

router.get('/image/:name', (req, res) => {
  if (!req.params.name) {
    return res.status(400).json({ message: responseMessage.INVALID_PARAMETERS });
  }

  return res.download(`images/${req.params.name}`);
});

router.patch('/update', authorizate, upload.single('bookCover'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: responseMessage.INVALID_PARAMETERS });
  }

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

  const { bookID, title, ISBN, price, condition, description } = req.body;

  if (!bookID || !title || !ISBN || !price || !condition || !description || bookID.length != 24) {
    return res.status(400).json({ message: responseMessage.INVALID_PARAMETERS });
  }

  const book = await Book.findOne({ _id: bookID });

  if (!book) {
    fs.unlinkSync(`images/${req.file.filename}.png`);
    return res.status(404).json({ message: responseMessage.NOT_FOUND });
  }

  if (!isbn3.parse(ISBN)?.isValid) {
    fs.unlinkSync(`images/${req.file.filename}.png`);
    return res.status(400).json({ message: responseMessage.INVALID_ISBN });
  }

  if (isNaN(Number(price))) {
    fs.unlinkSync(`images/${req.file.filename}.png`);
    return res.status(400).json({ message: responseMessage.PRICE_IS_NAN });
  }

  if (condition != 'New' && condition != 'Used') {
    fs.unlinkSync(`images/${req.file.filename}.png`);
    return res.status(400).json({ message: responseMessage.INVALID_CONDITION });
  }

  if (description.length < 200 || description.length > 1500) {
    fs.unlinkSync(`images/${req.file.filename}.png`);
    return res.status(400).json({ message: responseMessage.INVALID_DESCRIPTION_LENGTH });
  }

  const oldImageName = book.imageName;
  book.imageName = `${req.file.filename}.png`;

  if (book.title != title) book.title = title;
  if (book.ISBN != ISBN) book.ISBN = ISBN;
  if (book.price != price) book.price = price;
  if (book.condition != condition) book.condition = condition;
  if (book.description != description) book.description = description;

  book.save((err) => {
    if (err) {
      fs.unlinkSync(`images/${req.file.filename}.png`);
      return res.status(500).json({ message: responseMessage.INTERNAL_SERVER_ERROR });
    } else {
      fs.unlinkSync(`images/${oldImageName}`);
      return res.status(200).json({
        message: responseMessage.UPDATED_SUCCESSFULLY,
      });
    }
  });
});

module.exports = router;
