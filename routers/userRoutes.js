const { signIn, createUser } = require("../controllers/AuthController");
const { refreshBoth } = require("../services/AuthService");

const route = require("express").Router();

route.post("/register", createUser);

route.post("/refresh", refreshBoth);

route.post("/login", signIn);

module.exports = route;
