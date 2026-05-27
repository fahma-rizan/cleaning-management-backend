const jwt = require('jsonwebtoken');

// This middleware function is designed to be used in any route that needs to be protected.
// It checks for a valid JSON Web Token (JWT) in the request headers.
const auth = (req, res, next) => {
  // Get token from the 'Authorization' header, which should be in the format "Bearer <token>"
  const authHeader = req.header('Authorization');

  // Check if the Authorization header is present
  if (!authHeader) {
    // 401 Unauthorized: The request lacks valid authentication credentials.
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  // Split the header value to separate "Bearer" from the token
  const token = authHeader.split(' ')[1];

  // Check if the token part exists after "Bearer "
  if (!token) {
    return res.status(401).json({ message: 'Token is malformed, authorization denied' });
  }

  try {
    // FIX (Critical): Use JWT_SECRET from environment variable with fallback
    const jwtSecret = process.env.JWT_SECRET || 'your_super_secret_jwt_key_that_is_long_and_random';
    const decoded = jwt.verify(token, jwtSecret);

    // If the token is valid, the 'decoded' payload will contain the user information.
    // We attach this to the request object so that subsequent route handlers can access it.
    req.user = decoded.user;

    // Call the next middleware or route handler in the stack.
    next();
  } catch (err) {
    // 401 Unauthorized: The token is not valid (e.g., expired, tampered).
    res.status(401).json({ message: 'Token is not valid' });
  }
};

module.exports = auth;