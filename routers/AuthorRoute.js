const { secretSendOtp } = require("../controllers/AuthorController");
const CheckAuth = require("../middlewares/AuthMiddleware");

const route = require("express").Router();

route.post("/sendOtp", CheckAuth, secretSendOtp);

module.exports = route;
