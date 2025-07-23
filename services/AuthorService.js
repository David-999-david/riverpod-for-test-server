const { authorSecret, refreshEI } = require("../config/jwt");
const pool = require("../db");
const ApiError = require("../utils/apiError");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const { generateAccess, generateRefresh } = require("./AuthService");

async function checkSecret(secret_key, userId) {
  if (secret_key != authorSecret) {
    throw new ApiError(400, "Secret key is incorrect");
  }

  try {
    const min = 100_000;
    const max = 999_000;
    const otp = crypto.randomInt(min, max);
    const otpHash = crypto
      .createHash("sha256")
      .update(otp.toString())
      .digest("hex");
    const otpEi = parseInt(process.env.OTP_EI, 10);

    if (!otpHash) {
      throw new ApiError(500, "Failed to create otp hash");
    }

    const otpRes = await pool.query(
      `
        insert into user_otp
        (user_id,hash_otp,expires_at)
        values
        ($1,$2,now() + $3 * interval '1 minute')
        on conflict (user_id)
        do update set
        hash_otp = excluded.hash_otp,
        expires_at=excluded.expires_at,
        consumed = false
        `,
      [userId, otpHash, otpEi]
    );

    if (otpRes.rowCount === 0) {
      throw new ApiError(500, "Failed to create otp row");
    }

    const userRes = await pool.query(
      `
        select email from users
        where id=$1
        `,
      [userId]
    );

    if (userRes.rowCount === 0) {
      throw new ApiError(500, "User not found");
    }

    const email = userRes.rows[0].email;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: "没有油小墨水 <dontgun54@gmail.com>",
      to: email,
      subject: "Your otp code for upgrade to Author",
      html: `
      <html><body>
      <p>The opt code you need for upgrade to Author</p>
        <h1>${otp}</h1>
        <p>This otp will expires in 10 minutes</p>
      </html></body>
      `,
    });

    return "Please check your mail for otp";
  } catch (e) {
    throw new ApiError(e.statusCode, e.message);
  }
}

async function verifyAndUpgrade(userId, otp) {
  try {
    const hashedOtp = crypto
      .createHash("sha256")
      .update(otp.toString())
      .digest("hex");

    const otpRes = await pool.query(
      `
        select hash_otp, expires_at from user_otp
        where user_id = $1 and consumed = false
        `,
      [userId]
    );

    if (otpRes.rowCount === 0) {
      throw new ApiError(404, "User otp not found in database");
    }

    const { hash_otp: databaseHashOtp, expires_at: Ea } = otpRes.rows[0];

    if (Ea < new Date()) {
      throw new ApiError(500, "Otp is expired");
    }

    if (hashedOtp != databaseHashOtp) {
      throw new ApiError(404, "Otp is incorrect");
    }

    const result = await pool.query(
      `
      update user_otp
      set consumed = true
      where user_id =$1
      `,
      [userId]
    );

    if (result.rowCount === 0) {
      throw new ApiError(500, "Set otp consumed is failed");
    }

    const access = generateAccess(userId, "Author");

    const refresh = await generateRefresh(userId);

    if (!access) {
      throw new ApiError(500, "Generate access token for Author is failed");
    }

    if (!refresh) {
      throw new ApiError(500, "Generate refresh token for Author is failed");
    }

    const userRes = await pool.query(
      `
      update users
      set role = 'Author'
      where id = $1
      `,
      [userId]
    );

    if (userRes.rowCount === 0) {
      throw new ApiError(500, "Upgrade user to Author is Failed");
    }

    const refreshRes = await pool.query(
      `
      update user_refresh_token
      set
      refresh_token = $1,
      expires_in = now() + $2 * interval '1 minute'
      where userid=$3
      `,
      [refresh, refreshEI, userId]
    );

    if (refreshRes.rowCount === 0) {
      throw new ApiError(500, "Update refresh Failed");
    }

    const message = "Successfully upgrade to Author";

    return { access, refresh, message };
  } catch (e) {
    throw new ApiError(e.statusCode, e.message);
  }
}

module.exports = { checkSecret, verifyAndUpgrade };
