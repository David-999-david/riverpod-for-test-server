const {
  signIn,
  createUser,
  sendOtp,
  verifyOtp,
  changePsw,
  logOut,
} = require("../controllers/AuthController");
const CheckAuth = require("../middlewares/AuthMiddleware");
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

route.post("/signOut", CheckAuth, logOut);

module.exports = route;
