const { authorSecret } = require("../config/jwt");
const { checkSecret, verifyAndUpgrade } = require("../services/AuthorService");
const ApiError = require("../utils/apiError");
const crypto = require("crypto");

async function secretSendOtp(req, res, next) {
  const userId = req.userId;

  const { secret_key } = req.body;

  if (!userId) {
    return next(new ApiError(400, "Headers is missing"));
  }

  if (!secret_key) {
    return next(new ApiError(400, "Secret key is required!"));
  }

  try {
    const message = await checkSecret(secret_key, userId);
    return res.status(200).json({
      error: false,
      success: true,
      data: message,
    });
  } catch (e) {
    return next(e);
  }
}

async function verifyOtp(req, res, next) {
  const userId = req.userId;

  const { otp } = req.body;

  if (!userId) {
    return next(new ApiError(404, "Auth Headers is missing"));
  }

  if (!otp) {
    return next(new ApiError(400, "Otp is missing"));
  }

  try {
    const { access, refresh, message } = await verifyAndUpgrade(userId, otp);

    return res.status(200).json({
      error: false,
      success: true,
      data: {
        access,
        refresh,
        message,
      },
    });
  } catch (e) {
    return next(e);
  }
}

module.exports = { secretSendOtp, verifyOtp };
