const { ZodError } = require('zod');

const validate = (schema, source = 'body') => (req, res, next) => {
  try {
    const data = source === 'query' ? req.query : req.body;
    schema.parse(data);
    next();
  } catch (err) {
    if (err instanceof ZodError) {
      const message = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return res.status(400).json({ success: false, message });
    }
    next(err);
  }
};

module.exports = validate;
