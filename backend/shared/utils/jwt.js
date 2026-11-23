const jwt = require("jsonwebtoken");
const crypto = require("crypto");

function signAccessToken(payload, secret, expiresIn = "15m") {
  return jwt.sign(payload, secret, { expiresIn });
}

function signRefreshToken(payload, secret, expiresIn = "7d") {
  return jwt.sign(payload, secret, { expiresIn, jwtid: crypto.randomUUID() });
}

function verifyToken(token, secret) {
  return jwt.verify(token, secret);
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyToken,
};
