const jwt = require('jsonwebtoken');

module.exports.authorizate = (req, res, next) => {
  const token = req.headers['authorization'];

  if (!token) {
    return res.status(400).json({ message: responseMessage.INVALID_PARAMETERS });
  }

  jwt.verify(token, process.env.TOKEN_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: responseMessage.INVALID_AUTHORIZATION_TOKEN });
    }

    req.user = user;

    next();
  });
};

module.exports.isEmail = (str) => {
  return str
    .toLowerCase()
    .match(
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
    );
};
