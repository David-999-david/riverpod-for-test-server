const {
  secretSendOtp,
  verifyOtp,
  createBook,
  fetchAllBooks,
  fetchAllCategoryAndSub,
  createNewChapter,
  fetchAllChapters,
  editBookImage,
} = require("../controllers/author/AuthorController");
const CheckAuth = require("../middlewares/AuthMiddleware");
const { checkPermission } = require("../middlewares/AuthorizationCheck");
const { otpCallLimit } = require("../middlewares/RateLimit");
const multer = require("multer");
const upload = multer();

const route = require("express").Router();

route.post("/sendOtp", CheckAuth, otpCallLimit, secretSendOtp);

route.post("/verifyOtp", CheckAuth, verifyOtp);

route.post(
  "/createBook",
  CheckAuth,
  checkPermission("book:create"),
  upload.single("image"),
  createBook
);

route.get("/allBook", CheckAuth, checkPermission("book:read"), fetchAllBooks);

route.get(
  "/allCateSubCate",
  CheckAuth,
  checkPermission("book:read"),
  fetchAllCategoryAndSub
);

route.post(
  "/books/:bookId/createNewChapter",
  CheckAuth,
  checkPermission("book:create"),
  createNewChapter
);

route.get(
  "/books/:bookId/getAllChapters",
  CheckAuth,
  checkPermission("book:read"),
  fetchAllChapters
);

route.put(
  "/books/:bookId/changeImage",
  CheckAuth,
  checkPermission("book:update"),
  upload.single("image"),
  editBookImage
);

module.exports = route;
