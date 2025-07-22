const {
  signIn,
  createUser,
  sendOtp,
  verifyOtp,
  changePsw,
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

route.post("/changePsw", changePsw);

module.exports = route;
