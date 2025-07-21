const { changeNewPsw } = require("../services/AuthService");
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

async function changePsw(req, res, next) {
  const { resetToken, newPsw } = req.body;

  if (!resetToken) {
    return next(new ApiError(400, "Reset Token is missing"));
  }

  if (!newPsw) {
    return next(new ApiError(400, "New Password is required"));
  }

  try {
    const message = await changeNewPsw(resetToken, newPsw);

    return res.status(200).json({
      error: false,
      success: true,
      data: message,
    });
  } catch (e) {
    return next(e);
  }
}

module.exports = { otpCallLimit, forgotPasswordLimit };
