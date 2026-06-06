const jwt = require("jsonwebtoken");

/**
 * Signs a JWT token containing the user ID.
 * @param {string} id - User ID.
 * @returns {string} Signed JWT.
 */
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "10p",
  });
};

module.exports = { signToken };
