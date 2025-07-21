const ApiError = require("../utils/apiError");

const rateLimit = require("express-rate-limit").default;

const otpCallLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: {
    message: "Too Many Otp attempts, please request a new code later!",
  },
});

const forgotPasswordLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: {
    message: "Too Many reset password attempts,please try again later!",
  },
});



module.exports = { otpCallLimit, forgotPasswordLimit };
