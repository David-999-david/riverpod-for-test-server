const { secretSendOtp, verifyOtp } = require("../controllers/AuthorController");
const CheckAuth = require("../middlewares/AuthMiddleware");
const { otpCallLimit } = require("../middlewares/RateLimit");

const route = require("express").Router();

route.post("/sendOtp", CheckAuth, otpCallLimit, secretSendOtp);

route.post("/verifyOtp", CheckAuth, verifyOtp);

module.exports = route;
