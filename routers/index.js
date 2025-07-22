const AuthRoute = require("../routers/AuthRoute");
const userRoute = require("../routers/user");
const Author = require("../routers/AuthorRoute");

const route = require("express").Router();

route.use("/auth", AuthRoute);

route.use("/user", userRoute);

route.use("/author", Author);

module.exports = route;
