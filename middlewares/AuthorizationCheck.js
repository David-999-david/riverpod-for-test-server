const ApiError = require("../utils/apiError");

function checkPermission(allowPermissions) {
  const permsToCheck = Array.isArray(allowPermissions)
    ? allowPermissions
    : [allowPermissions];

  return (req, res, next) => {
    const userPerms = req.userPerms;

    const hasOne = permsToCheck.some((p) => userPerms.includes(p));

    if (!hasOne) {
      return next(new ApiError(400, "User have no permission for this action"));
    }

    next();
  };
}

module.exports = { checkPermission };
