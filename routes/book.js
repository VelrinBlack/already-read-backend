const express = require('express');
const Book = require('../models/Book');
const { responseMessages } = require('../strings.json');

const router = express.Router();

router.get('/getFiltered', async (req, res) => {
  if (req.query.title) {
    let books = await Book.find();
    books = books.filter((book) => book.title.toLowerCase() === req.query.title.toLowerCase());
    if (!books.length) return res.status(404).json({ message: responseMessages.notFound });
    return res.status(200).json({ books });
  } else if (req.query.ISBN) {
    let books = await Book.find({ ISBN: req.query.ISBN });
    if (!books.length) return res.status(404).json({ message: responseMessages.notFound });
    return res.status(200).json({ books });
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
