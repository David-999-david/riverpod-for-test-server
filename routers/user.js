const {
  getuserINfo,
  viewAllAuthor,
  fetchAllAuthorsBooks,
} = require("../controllers/UserController");
const CheckAuth = require("../middlewares/AuthMiddleware");
const { checkPermission } = require("../middlewares/AuthorizationCheck");

const route = require("express").Router();

route.get("/info", CheckAuth, getuserINfo);

route.get(
  "/getAuthors",
  CheckAuth,
  checkPermission("book:read"),
  viewAllAuthor
);

route.get(
  "/getAllAuthorsBooks",
  CheckAuth,
  checkPermission("book:read"),
  fetchAllAuthorsBooks
);

module.exports = route;
