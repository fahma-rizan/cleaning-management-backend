const passport       = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const crypto         = require('crypto');
const User           = require('../models/User');
const AUTH           = require('../constants/auth');

passport.use(
  new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:  process.env.GOOGLE_CALLBACK_URL,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        //get the email from the profile, if not found return an error.
        const email = profile.emails?.[0]?.value;
        if (!email) return done(new Error('Google did not return an email address'));

        //check if user already exists.
        let user = await User.findOne({ email }).select('+googleId');

        if (user) {
          //if the user exists but doesn't have a googleId.
          if (!user.isActive) return done(new Error('Account is deactivated'));

          // associate the googleId with the existing user
          if (!user.googleId) {
            user.googleId = profile.id;
            await user.save();
          }
        } else {

          //if user doesn't exist, create a new one.
          user = await User.create({
            name:       profile.displayName || email.split('@')[0],
            email,
            password:   crypto.randomBytes(32).toString('hex'), // unusable placeholder
            role:       AUTH.ROLES.CUSTOMER,
            isVerified: true,
            isActive:   true,
            googleId:   profile.id,
          });
        }
        //successful authentication, return the user
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

module.exports = passport;
