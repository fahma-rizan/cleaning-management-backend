const AUTH = {
  JWT_ACCESS_EXPIRY:  '15m',
  JWT_REFRESH_EXPIRY: '7d',
  BCRYPT_SALT_ROUNDS: 12,
  OTP_LENGTH:         6,
  OTP_EXPIRY_MINUTES: 10,
  OTP_MAX_ATTEMPTS:   3,
  REFRESH_TOKEN_DAYS: 7,

  // min 8 chars, at least 1 uppercase, at least 1 number
  PASSWORD_REGEX: /^(?=.*[A-Z])(?=.*\d).{8,}$/,
  PASSWORD_RULE:  'Password must be at least 8 characters with 1 uppercase letter and 1 number',

  ROLES: {
    SUPER_ADMIN:            'super_admin',
    MAIN_ADMIN:             'main_admin',
    OPERATION_ADMIN:        'operation_admin',
    CUSTOMER_SUPPORT_ADMIN: 'customer_support_admin',
    STAFF:                  'staff',
    CUSTOMER:               'customer',
    ADMIN:                  'admin', // legacy alias for super_admin — kept for backward compat
  },

  // All roles that can access the admin dashboard
  ADMIN_ROLES: ['super_admin', 'main_admin', 'operation_admin', 'customer_support_admin', 'admin'],

  // Admin + staff (can access staff-level features)
  STAFF_ROLES: ['super_admin', 'main_admin', 'operation_admin', 'customer_support_admin', 'staff', 'admin'],

  OTP_PURPOSES: {
    VERIFY_EMAIL:   'verify_email',
    RESET_PASSWORD: 'reset_password',
  },
};

module.exports = AUTH;
