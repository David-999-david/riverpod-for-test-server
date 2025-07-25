require("dotenv").config();
const jwt = require("jsonwebtoken");
const { accessEI, accessTk, refreshTk, refreshEI } = require("../config/jwt");
const ApiError = require("../utils/apiError");
const pool = require("../db");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

function generateAccess(userId, userRole, permissions) {
  return jwt.sign(
    { userId, purpose: "access", userRole, permissions },
    accessTk,
    {
      expiresIn: accessEI,
    }
  );
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

    const permRows = await pool.query(
      `
        select 
        r.name as role,
        p.name as permission
        from user_roles as ur
        join roles as r on r.id = ur.role_id
        join role_permissions as rp on rp.role_id = r.id
        join permissions as p on p.id = rp.permission_id
        where ur.user_id=$1
        `,
      [userId]
    );

    if (permRows.rowCount === 0) {
      return next(new ApiError(401, "User not found!"));
    }

    const userRole = permRows.rows[0].role;

    const userPerms = permRows.rows.map((p) => p.permission);

    const newAccess = generateAccess(userId, userRole, userPerms);

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
  try {
    const hashedPsw = await bcrypt.hash(password, 10);

    const incomingPhone = phone ? phone : null;

    const userRes = await pool.query(
      `
      insert into users
      (name,email,phone,password_hash)
      values
      ($1,$2,$3,$4)
      returning id
      `,
      [name, email, incomingPhone, hashedPsw]
    );

    if (userRes.rowCount === 0) {
      throw new ApiError(500, "Failed to insert new user");
    }

    const userId = userRes.rows[0].id;

    const roleRes = await pool.query(
      `
      select id,name from roles
      where name = $1
      `,
      ["user"]
    );

    if (roleRes.rowCount === 0) {
      throw new ApiError(500, "Can't find the role about user");
    }

    const { id: roleId, name: userRole } = roleRes.rows[0];

    const linkRes = await pool.query(
      `
      insert into user_roles
      (user_id,role_id)
      values
      ($1,$2)
      `,
      [userId, roleId]
    );

    if (linkRes.rowCount === 0) {
      throw new ApiError(
        500,
        "Failed to connect insert for new user with user role"
      );
    }

    const { rows: perRows } = await pool.query(
      `
      select p.name
      from permissions as p
      join role_permissions as rp on rp.permission_id = p.id
      join user_roles as ur on ur.role_id = rp.role_id
      where ur.user_id =$1
      `,
      [userId]
    );

    if (perRows.length === 0) {
      throw new ApiError(500, "Current user have nothing permissions");
    }

    const permissions = perRows.map((r) => r.name);

    const access = generateAccess(userId, userRole, permissions);

    const refresh = await generateRefresh(userId);

    return { access, refresh };
  } catch (e) {
    throw new ApiError(e.statusCode, e.message);
  }
}

async function login(email, password) {
  try {
    const userRes = await pool.query(
      `
    select id,password_hash
    from users
    where email =$1
    `,
      [email]
    );

    if (userRes.rowCount === 0) {
      throw new ApiError(404, "User not found!");
    }

    const { id: userId, password_hash: hashPsw } = userRes.rows[0];

    const compare = await bcrypt.compare(password, hashPsw);

    if (!compare) {
      throw new ApiError(400, "Password is incorrect!");
    }

    const permRows = await pool.query(
      `
      select 
      r.name as role,
      p.name as permission
      from user_roles as ur
      join roles as r on r.id = ur.role_id
      join role_permissions as rp on rp.role_id = r.id
      join permissions as p on p.id = rp.permission_id
      where ur.user_id =$1
      `,
      [userId]
    );

    if (permRows.rowCount === 0) {
      throw new ApiError(
        500,
        "Cant find the role and permission for this user"
      );
    }

    const userRole = permRows.rows[0].role;

    const permissions = permRows.rows.map((p) => p.permission);

    const access = generateAccess(userId, userRole, permissions);

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
    ($1,$2,now() + $3 * INTERVAL '1 minute')
    on conflict (user_id)
    do update set
    hash_otp = excluded.hash_otp,
    expires_at = excluded.expires_at,
    consumed = false,
    created_at = now()

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

async function verifyOtpAndGenerateResetToken(otp, email) {
  try {
    const userRes = await pool.query(
      `
    select id from users
    where email=$1
    `,
      [email]
    );

    if (userRes.rowCount === 0) {
      throw new ApiError(404, "User with email not found!");
    }

    const userId = userRes.rows[0].id;

    const otpRes = await pool.query(
      `
    select id,hash_otp,expires_at from user_otp
    where user_id=$1 and consumed = false
    `,
      [userId]
    );

    if (otpRes.rowCount === 0) {
      throw new ApiError(404, "Otp not found user");
    }

    const { id: otpId, hash_otp: hashedOtp, expires_at: EA } = otpRes.rows[0];

    if (EA < new Date()) {
      throw new ApiError(400, "Otp is expired");
    }

    const incomintOtp = crypto.createHash("sha256").update(otp).digest("hex");

    if (incomintOtp !== hashedOtp) {
      throw new ApiError(400, "The input Otp Code is not match");
    }

    const resetTk = process.env.RESET_TK;

    const expiresIn = parseInt(process.env.RESET_EI, 10);

    const ResetToken = jwt.sign({ userId, purpose: "reset" }, resetTk, {
      expiresIn: expiresIn,
    });

    if (!ResetToken) {
      throw new ApiError(500, "Failed to generate reset token");
    }

    await pool.query(
      `
      update user_otp
      set consumed = true
      where id =$1
      `,
      [otpId]
    );

    return ResetToken;
  } catch (e) {
    throw new ApiError(e.statusCode, e.message);
  }
}

async function changeNewPsw(resetToken, newPsw) {
  try {
    let payload;
    try {
      payload = jwt.verify(resetToken, process.env.RESET_TK);
    } catch (e) {
      throw new ApiError(e.statusCode, e.message);
    }

    const userId = payload.userId;

    const newPswHash = await bcrypt.hash(newPsw, 10);

    const { rows } = await pool.query(
      `
      update users
      set password_hash =$1
      where id=$2
      returning id
      `,
      [newPswHash, userId]
    );

    if (rows.length === 0) {
      throw new ApiError(500, "Change password Failed");
    }

    await pool.query(
      `
      update user_otp
      set consumed = true
      where user_id=$1
      `,
      [userId]
    );

    const message = "Password Reset successfully!";

    return message;
  } catch (e) {
    throw new ApiError(e.statusCode, e.message);
  }
}

async function signOut(userId, refresh) {
  try {
    const refreshRes = await pool.query(
      `
    delete from user_refresh_token
    where userid = $1 and refresh_token=$2
    `,
      [userId, refresh]
    );

    if (refreshRes.rowCount === 0) {
      throw new ApiError(500, "Can't find and delete refresh token for user");
    }

    return "SignOut success";
  } catch (e) {
    throw new ApiError(e.statusCode, e.message);
  }
}

module.exports = {
  registerUser,
  login,
  refreshBoth,
  verifyAndSendOtp,
  verifyOtpAndGenerateResetToken,
  changeNewPsw,
  generateAccess,
  generateRefresh,
  signOut
};
