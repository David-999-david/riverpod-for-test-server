require("dotenv").config();
const jwt = require("jsonwebtoken");
const { accessEI, accessTk, refreshTk, refreshEI } = require("../config/jwt");
const ApiError = require("../utils/apiError");
const pool = require("../db");
const bcrypt = require("bcrypt");

function generateAccess(userId, userRole) {
  return jwt.sign({ userId, purpose: "access", userRole }, accessTk, {
    expiresIn: accessEI,
  });
}

async function generateRefresh(userId) {
  const refresh = jwt.sign(
    { userId, purpose: "refresh" },
    refreshTk,

    { expiresIn: refreshEI }
  );

  if (!refresh) {
    throw new ApiError(500, "Failed to generate refresh token");
  }

  await pool.query(
    `
    insert into user_refresh_token
    (userid,refresh_token,expires_in)
    values
    ($1,$2,now() + $3 * interval '1 minute')
    `,
    [userId, refresh, refreshEI]
  );

  return refresh;
}

async function refreshBoth(req, res, next) {
  try {
    const { refreshTok } = req.body;

    if (!refreshTok) {
      return next(new ApiError(400, "Refresh token is missing"));
    }

    let payload;
    try {
      payload = jwt.verify(refreshTok, refreshTk);
    } catch (e) {
      if (e.name === "TokenExpiredError") {
        return next(new ApiError(401, "Refresh Token expired."));
      } else {
        return next(new ApiError(401, "Invalid refresh Token"));
      }
    }

    const userId = payload.userId;

    const result = await pool.query(
      `
    select 1 from user_refresh_token
    where userid = $1 and refresh_token=$2
    `,
      [userId, refreshTok]
    );

    if (result.rowCount === 0) {
      return next(new ApiError(401, "Can't find expired of user refreshToken"));
    }

    await pool.query(
      `
        delete from user_refresh_token
        where userid =$1 and refresh_token=$2
        `,
      [userId, refreshTok]
    );

    const { rows } = await pool.query(
      `
        select role from users 
        where id =$1
        `,
      [userId]
    );

    if (rows.length === 0) {
      return next(new ApiError(401, "User not found!"));
    }

    const userRole = rows[0].role;

    const newAccess = generateAccess(userId, userRole);

    const newRefresh = await generateRefresh(userId);

    return res.status(201).json({
      error: false,
      success: true,
      data: {
        newAccess,
        newRefresh,
      },
    });
  } catch (e) {
    return next(e);
  }
}

async function registerUser(name, email, phone, password) {
  const userPhone = phone ? phone : null;

  const hashedPsw = await bcrypt.hash(password, 10);

  try {
    const { rows } = await pool.query(
      `
        insert into users
        (name,email,phone,password_hash)
        values
        ($1,$2,$3,$4)
        returning *
        `,
      [name, email, userPhone, hashedPsw]
    );

    if (rows.length === 0) {
      throw new ApiError(500, "Failed to create new user");
    }

    const userId = rows[0].id;
    const userRole = rows[0].role;

    const access = generateAccess(userId, userRole);

    const refresh = await generateRefresh(userId);

    if (!access) {
      throw new ApiError(500, "Jwt Error when generate access token");
    }

    if (!refresh) {
      throw new ApiError(500, "Jwt Error when generate refresh token");
    }

    return { access, refresh };
  } catch (e) {
    throw new ApiError(e.statusCode, e.message);
  }
}

async function login(email, password) {
  try {
    const userRes = await pool.query(
      `
    select password_hash,role from users
    where email =$1
    `,
      [email]
    );

    if (userRes.rowCount === 0) {
      throw new ApiError(404, "User not found!");
    }

    const hashPsw = userRes.rows[0].password_hash;

    const compare = await bcrypt.compare(password, hashPsw);

    if (!compare) {
      throw new ApiError(400, "Password is incorrect!");
    }

    const userRole = userRes.rows[0].role;

    const access = generateAccess(userId, userRole);

    const refresh = await generateRefresh(userId);

    if (!access) {
      throw new ApiError(401, "Jwt Error when generate access token");
    }

    if (!refresh) {
      throw new ApiError(401, "Jwt Error when generate refresh token");
    }

    const message = "Successfully login!";

    return { message, access, refresh };
  } catch (e) {
    throw new ApiError(e.statusCode, e.message);
  }
}

module.exports = {
  registerUser,
  login,
  refreshBoth,
};
