const { accessTk } = require("../config/jwt");
const ApiError = require("../utils/apiError");
const jwt = require("jsonwebtoken");

async function CheckAuth(req, res, next) {
  const header = req.headers.authorization;

  if (!header) {
    return next(new ApiError(401, "Header is missing"));
  }

  const [schema, token] = header.split(" ");

  if (schema.toLowerCase() !== "bearer") {
    return next(new ApiError(401, "Invalid Header"));
  }

  if (!token) {
    return next(new ApiError(401, "Token is missing"));
  }

  try {
    const payload = jwt.verify(token, accessTk);

    req.userId = payload.userId;
    req.userRole = payload.userRole;
    return next();
  } catch (e) {
    if (e.name === "TokenExpiredError") {
      return next(new ApiError(401, "Token expired"));
    }
    return next(new ApiError(401, "Invalid token"));
  }
}

module.exports = CheckAuth;
