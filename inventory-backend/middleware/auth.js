const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
  const auth = req.headers.authorization || req.headers.Authorization || req.headers['x-access-token'];
  if (!auth) return res.status(401).json({ message: 'No token provided' });

  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'devsecret');
    req.userId = payload.sub;
    req.username = payload.username;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};
