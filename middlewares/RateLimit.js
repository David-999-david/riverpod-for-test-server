const rateLimit = require("express-rate-limit").default;

const otpCallLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error: "Too Many Otp attempts, please request a new code later!",
  },
});

const forgotPasswordLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error: "Too Many reset password attempts,please try again later!",
  },
});

module.exports = { otpCallLimit, forgotPasswordLimit };
