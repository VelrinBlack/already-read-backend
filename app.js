const express = require('express');
const mongoose = require('mongoose');
const user = require('./routes/user');

require('dotenv').config();

const app = express();
const port = 5000;

app.use(express.json());

const connectDB = async () => {
  await mongoose.connect(process.env.MONGODB_CONNECTION_STRING);
};

connectDB().catch((err) => console.log(err));

app.use('/user', user);

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
