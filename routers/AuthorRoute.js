const {
  secretSendOtp,
  verifyOtp,
  createBook,
  fetchAllBooks,
} = require("../controllers/author/AuthorController");
const CheckAuth = require("../middlewares/AuthMiddleware");
const { checkPermission } = require("../middlewares/AuthorizationCheck");
const { otpCallLimit } = require("../middlewares/RateLimit");

const route = require("express").Router();

route.post("/sendOtp", CheckAuth, otpCallLimit, secretSendOtp);

route.post("/verifyOtp", CheckAuth, verifyOtp);

route.post("/createBook", CheckAuth, createBook);

route.get("/allBook", CheckAuth, checkPermission("book:read"), fetchAllBooks);

module.exports = route;
