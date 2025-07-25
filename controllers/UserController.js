const { userInfo, getAllAuthor } = require("../services/UserService");
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

async function viewAllAuthor(req, res, next) {
  const userId = req.userId;

  if (!userId) {
    return next(new ApiError(400, "Headers is missing"));
  }

  try {
    const authors = await getAllAuthor();

    return res.status(200).json({
      error: false,
      success: true,
      data: authors,
    });
  } catch (e) {
    return next(e);
  }
}

module.exports = { getuserINfo, viewAllAuthor };
