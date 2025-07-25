const { userInfo } = require("../services/UserService");
const ApiError = require("../utils/apiError");

async function getuserINfo(req, res, next) {
  const userId = req.userId;

  if (!userId) {
    return next(new ApiError(404, "Headers is missing"));
  }

  try {
    const info = await userInfo(userId);

    return res.status(200).json({
      error: false,
      success: true,
      data: info,
    });
  } catch (e) {
    return next(e);
  }
}

module.exports = { getuserINfo };
