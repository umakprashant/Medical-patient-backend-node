const jwt = require("jsonwebtoken");

const getSecret = () => process.env.JWT_SECRET || process.env.jWT_SECRET; // Handle casing from .env check

const generateToken = (payload) =>
  jwt.sign(payload, getSecret(), { expiresIn: "1d" });

const verifyToken = (token) => jwt.verify(token, getSecret());

const generateRefreshToken = (payload) =>
  jwt.sign(payload, getSecret(), { expiresIn: "30d" });

const verifyRefreshToken = (token) => 
  jwt.verify(token, getSecret());

module.exports = { generateToken, verifyToken, generateRefreshToken, verifyRefreshToken };
