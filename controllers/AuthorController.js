const { authorSecret } = require("../config/jwt");
const { checkSecret } = require("../services/AuthorService");
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

module.exports = { secretSendOtp };
