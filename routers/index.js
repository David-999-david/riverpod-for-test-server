const userRoute = require("../routers/userRoutes");

const route = require("express").Router();

route.use("/auth", userRoute);

module.exports = route;
