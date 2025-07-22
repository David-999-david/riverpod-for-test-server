const { authorSecret } = require("../config/jwt");
const pool = require("../db");
const ApiError = require("../utils/apiError");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

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
        expires_at=excluded.expires_at
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

module.exports = { checkSecret };
