const { getuserINfo } = require("../controllers/UserController");
const CheckAuth = require("../middlewares/AuthMiddleware");

const route = require("express").Router();

route.get("/info", CheckAuth, getuserINfo);

module.exports = route;
