const ApiError = require("../utils/apiError");

async function ErrorHandler(err, req, res, next) {
  const code = typeof err.statusCode === "number" ? err.statusCode : 500;

  console.log(err.stack);

  res.status(code).json({
    status: err.status || err.statusCode,
    success: false,
    message: err.message || "Server error",
  });
}

module.exports = { ErrorHandler };
