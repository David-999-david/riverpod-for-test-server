const pool = require("../db");
const ApiError = require("../utils/apiError");

async function userInfo(userId) {
  try {
    const userRes = await pool.query(
      `
        select name,email from users
        where id=$1
        `,
      [userId]
    );

    if (userRes.rowCount === 0) {
      throw new ApiError(404, "User not found");
    }

    const { name, email } = userRes.rows[0];
    return {name, email};
  } catch (e) {
    throw new ApiError(e.statusCode, e.message);
  }
}

module.exports = { userInfo };
