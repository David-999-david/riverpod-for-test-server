const pool = require("../db");
const ApiError = require("../utils/apiError");

async function userInfo(userId) {
  try {
    const userRes = await pool.query(
      `
        select
        u.name as name,
        u.email as email,
        array_agg(distinct r.name) as role,
        array_agg(p.name) as permissions
        from users as u
        join user_roles as ur on ur.user_id = u.id
        join roles as r on r.id = ur.role_id
        join role_permissions as rp on rp.role_id = r.id
        join permissions as p on p.id = rp.permission_id
        where u.id =$1
        group by u.name , u.email
        `,
      [userId]
    );

    if (userRes.rowCount === 0) {
      throw new ApiError(404, "User not found");
    }

    return userRes.rows[0];
  } catch (e) {
    throw new ApiError(e.statusCode, e.message);
  }
}

module.exports = { userInfo };
