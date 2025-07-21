const {
  insertUser,
  registerUser,
  login,
  verifyAndSendOtp,
  verifyOtpAndGenerateResetToken,
  changeNewPsw,
} = require("../services/AuthService");
const ApiError = require("../utils/apiError");

async function createUser(req, res, next) {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !password) {
      return next(new ApiError(400, "Required fields for created new user"));
    }

    const { access, refresh } = await registerUser(
      name,
      email,
      phone,
      password
    );

    return res.status(201).json({
      error: false,
      success: true,
      message: "Create user successfully",
      data: {
        access,
        refresh,
      },
    });
  } catch (e) {
    next(e);
  }
}

async function signIn(req, res, next) {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new ApiError(400, "Email or Password are required!"));
  }

  try {
    const { message, access, refresh } = await login(email, password);

    return res.status(200).json({
      error: false,
      success: true,
      message,
      data: {
        access,
        refresh,
      },
    });
  } catch (e) {
    return next(e);
  }
}

async function sendOtp(req, res, next) {
  const { email } = req.body;

  if (!email) {
    return next(new ApiError(400, "Email must not be empty!"));
  }

  try {
    const message = await verifyAndSendOtp(email);

    return res.status(200).json({
      error: false,
      success: true,
      message,
    });
  } catch (e) {
    return next(e);
  }
}

async function verifyOtp(req, res, next) {
  const { otp, email } = req.body;

  if (!otp) {
    return next(new ApiError(400, "Otp is missing"));
  }

  if (!email) {
    return next(new ApiError(400, "Email is missing"));
  }

  try {
    const resetToken = await verifyOtpAndGenerateResetToken(otp, email);

    return res.status(200).json({
      error: false,
      success: true,
      resetToken,
    });
  } catch (e) {
    return next(e);
  }
}

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

module.exports = { createUser, signIn, sendOtp, verifyOtp, changePsw };
