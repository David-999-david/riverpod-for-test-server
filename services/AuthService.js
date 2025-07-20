require("dotenv").config();
const jwt = require("jsonwebtoken");
const { accessEI, accessTk, refreshTk, refreshEI } = require("../config/jwt");
const ApiError = require("../utils/apiError");
const pool = require("../db");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

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
    select id, password_hash,role from users
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

    const userId = userRes.rows[0].id;

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

async function verifyAndSendOtp(email) {
  try {
    const userRes = await pool.query(
      `select id from users
    where email =$1
    `,
      [email]
    );

    if (userRes.rows.length === 0) {
      throw new ApiError(404, "User not found");
    }

    const userId = userRes.rows[0].id;

    // const otp = crypto.randomBytes(32).toString("hex");
    const min = 100_000;
    const max = 999_999;
    const otp = crypto.randomInt(min, max);
    const hashOtp = crypto
      .createHash("sha256")
      .update(otp.toString())
      .digest("hex");

    const otpEI = parseInt(process.env.OTP_EI, 10);

    if (!otp || !hashOtp) {
      throw new ApiError(500, "The opt or otp_hash is failed");
    }

    const otpRes = await pool.query(
      `
    insert into user_otp
    (user_id,hash_otp,expires_at)
    values
    ($1,$2,now() + $3 * INTERVAL '1 second')
    `,
      [userId, hashOtp, otpEI]
    );

    if (otpRes.rowCount === 0) {
      throw new ApiError(400, "Failed to insert otp data for user");
    }

    const emailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await emailTransporter.sendMail({
      from: "没有油小墨水 <dontgun54@gmail.com>",
      to: email,
      subject: "Your password reset otp",
      html: `
      <html><body>
    <p>Your password reset otp is</p>
    <h1>${otp}</h1>
    <p>Otp will expires in 10 minutes'</p>
    </body></html>
    `,
    });

    const message = `If ${email} is registered, Your mail will receive an otp later, please check you mail`;

    return message;
  } catch (e) {
    throw new ApiError(e.statusCode, e.message);
  }
}

module.exports = {
  registerUser,
  login,
  refreshBoth,
  verifyAndSendOtp,
};
