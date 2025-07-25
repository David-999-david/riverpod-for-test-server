const { authorSecret } = require("../../config/jwt");
const ApiError = require("../../utils/apiError");
const crypto = require("crypto");
const {
  insertBook,
  getAllBooks,
  checkSecret,
  verifyAndUpgrade,
} = require("../../services/author/AuthorService");

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

async function createBook(req, res, next) {
  const userId = req.userId;

  if (!userId) {
    return next(400, "Header is missing");
  }

  // const permission = req.userPrems;

  // if (!permission.includes("book:create")) {
  //   return next(
  //     new ApiError(403, "This user is not get permission about this task")
  //   );
  // }

  const role = req.userRole;

  if (role !== "author") {
    return next(
      new ApiError(400, "This user is not get permission about this task")
    );
  }

  const { category, subCategory, name, description } = req.body;

  if (!category) {
    return next(new ApiError(400, "Category is missing"));
  }

  if (!subCategory) {
    return next(new ApiError(400, "Sub-category is missing"));
  }

  if (!name) {
    return next(new ApiError(400, "Book name is missing"));
  }

  if (!description) {
    return next(new ApiError(400, "Book description is missing"));
  }

  try {
    const { categoryName, subCateName, authorName, book } = await insertBook(
      userId,
      category,
      subCategory,
      name,
      description
    );

    return res.status(201).json({
      error: false,
      success: true,
      data: { categoryName, subCateName, authorName, book },
    });
  } catch (e) {
    return next(e);
  }
}

async function fetchAllBooks(req, res, next) {
  const authorId = req.userId;

  if (!authorId) {
    return next(new ApiError(400, "Header is missing"));
  }

  const userRole = req.userRole;

  try {
    const books = await getAllBooks(authorId);

    return res.status(200).json({
      error: false,
      success: true,
      data: books,
    });
  } catch (e) {
    return next(e);
  }
}
module.exports = { secretSendOtp, verifyOtp, createBook, fetchAllBooks };
