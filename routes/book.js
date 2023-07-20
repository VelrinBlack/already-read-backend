const express = require('express');
const Book = require('../models/Book');
const { responseMessages } = require('../strings.json');

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
          return res.status(404).json({ message: responseMessages.notFound });
        }
      }
    } else if (title) {
      let books = await Book.find();
      books = books.filter((book) => book.title.toLowerCase() === title.toLowerCase());
      if (!books.length) return res.status(404).json({ message: responseMessages.notFound });
      return res.status(200).json({ books });
    } else {
      let books = await Book.find({ ISBN: isbn });
      if (!books.length) return res.status(404).json({ message: responseMessages.notFound });
      return res.status(200).json({ books });
    }
  } else {
    return res.status(400).json({ message: responseMessages.invalidParameters });
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
      return res.status(404).json({ message: responseMessages.notFound });
    }

    if (book) {
      return res.status(200).json({
        book: {
          title: book.title,
          price: book.price,
          condition: book.condition,
          imageName: book.imageName,
          seller: book.seller,
          description: book.description,
        },
      });
    } else {
      return res.status(404).json({ message: responseMessages.notFound });
    }
  } else {
    return res.status(400).json({ message: responseMessages.invalidParameters });
  }
});

router.get('/image/:name', (req, res) => {
  if (!req.params.name) {
    return res.status(400).json({ message: responseMessages.invalidParameters });
  }

  return res.download(`images/${req.params.name}`);
});

module.exports = router;
