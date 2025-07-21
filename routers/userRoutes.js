const {
  signIn,
  createUser,
  sendOtp,
  verifyOtp,
} = require("../controllers/AuthController");
const {
  otpCallLimit,
  forgotPasswordLimit,
} = require("../middlewares/RateLimit");
const { refreshBoth } = require("../services/AuthService");

const route = require("express").Router();

route.post("/register", createUser);

route.post("/refresh", refreshBoth);

route.post("/login", signIn);

route.post("/requestOtp", forgotPasswordLimit, sendOtp);

route.post("/verifyOtp", otpCallLimit, verifyOtp);

module.exports = route;
