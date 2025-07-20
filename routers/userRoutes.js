const {
  signIn,
  createUser,
  sendOtp,
} = require("../controllers/AuthController");
const { otpCallLimit } = require("../middlewares/RateLimit");
const { refreshBoth } = require("../services/AuthService");

const route = require("express").Router();

route.post("/register", createUser);

route.post("/refresh", refreshBoth);

route.post("/login", signIn);

route.post("/requestOtp", otpCallLimit, sendOtp);

module.exports = route;
