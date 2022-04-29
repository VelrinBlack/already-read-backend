require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const user = require('./routes/user');

const app = express();
const port = 5000;

app.use(express.json());
app.use(cors());

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
