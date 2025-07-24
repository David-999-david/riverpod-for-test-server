const { authorSecret, refreshEI } = require("../../config/jwt");
const pool = require("../../db");
const ApiError = require("../../utils/apiError");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const { generateAccess, generateRefresh } = require("../AuthService");

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

    const rolesRes = await pool.query(
      `
      select id,name
      from roles
      where name=$1
      `,
      ["author"]
    );

    if (rolesRes.rowCount === 0) {
      throw new ApiError(500, "Author role is not found in database");
    }

    const { id: roleId, name: userRole } = rolesRes.rows[0];

    const linkRes = await pool.query(
      `
      insert into user_roles
      (user_id,role_id)
      values
      ($1,$2)
      on conflict (user_id)
      do update set
      role_id = excluded.role_id,
      updated_at = now()
      
      `,
      [userId, roleId]
    );

    if (linkRes.rowCount === 0) {
      throw new ApiError(
        500,
        "Upgrade user role id in user_role table database is failed"
      );
    }

    const permRows = await pool.query(
      `
      select p.name as permission
      from roles as r
      join role_permissions as rp on rp.role_id = r.id
      join permissions as p on p.id = rp.permission_id
      where r.id = $1
      `,
      [roleId]
    );

    if (permRows.rowCount === 0) {
      throw new ApiError(500, "Failed to upgrade the permissions for author");
    }

    const permissions = permRows.rows.map((p) => p.permission);

    const access = generateAccess(userId, userRole, permissions);

    const refresh = await generateRefresh(userId);

    if (!access) {
      throw new ApiError(500, "Generate access token for Author is failed");
    }

    if (!refresh) {
      throw new ApiError(500, "Generate refresh token for Author is failed");
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

async function insertBook(userId, category, subCategory, name, description) {
  try {
    let categoryRes = await pool.query(
      `
      insert into category
      (name)
      values
      ($1)
      on conflict (name)
      do nothing
      returning *
      `,
      [category]
    );

    if (categoryRes.rowCount === 0) {
      categoryRes = await pool.query(
        `
        select id,name from category where name=$1
        `,
        [category]
      );
    }

    const { id: categoryId, name: categoryName } = categoryRes.rows[0];

    let subCateRes = await pool.query(
      `
      insert into sub_category
      (name,category_id)
      values
      ($1,$2)
      on conflict (name,category_id) do nothing
      returning *
      `,
      [subCategory, categoryId]
    );

    if (subCateRes.rowCount === 0) {
      subCateRes = await pool.query(
        `
        select id,name from sub_category
        where name =$1 and category_id=$2
        `,
        [subCategory, categoryId]
      );
    }

    const { id: subCateId, name: subCateName } = subCateRes.rows[0];

    const bookRes = await pool.query(
      `
      insert into book
      (name,description)
      values
      ($1,$2)
      returning *
      `,
      [name, description]
    );

    if (bookRes.rowCount === 0) {
      throw new ApiError(500, "Failed to create a book");
    }

    const bookId = bookRes.rows[0].id;

    const bookSubLink = await pool.query(
      `insert into book_sub_category
      (book_id,sub_category_id)
      values
      ($1,$2)
      `,
      [bookId, subCateId]
    );

    if (bookSubLink.rowCount === 0) {
      throw new ApiError(
        500,
        "Failed to make a link realtion between book with subcategory"
      );
    }

    const bookAuthorLink = await pool.query(
      `
      insert into author_book
      (author_id,book_id)
      values
      ($1,$2)
      `,
      [userId, bookId]
    );

    if (bookAuthorLink.rowCount === 0) {
      throw new ApiError(
        500,
        "Failed to make link realtion between author with book"
      );
    }

    const book = bookRes.rows[0];

    const userRes = await pool.query(
      `
      select name from users
      where id = $1
      `,
      [userId]
    );

    if (userRes.rowCount === 0) {
      throw new ApiError(404, "User not found");
    }

    const { name: authorName } = userRes.rows[0];

    return { categoryName, subCateName, authorName, book };
  } catch (e) {
    throw new ApiError(e.statusCode, e.message);
  }
}

async function getAllBooks(authorId) {
  try {
    const linkRes = await pool.query(
      `
    select
    c.name as "category",
    b.id as "bookId",
    b.name as "bookName",
    b.description as "bookDesc",
    u.name as "authorName",
    sc.name as "subCategory"
    from author_book as ab
    join users as u on u.id = ab.author_id
    join book as b on b.id = ab.book_id
    join book_sub_category as bs on bs.book_id = b.id
    join sub_category as sc on sc.id = bs.sub_category_id
    join category as c on c.id = sc.category_id
    where author_id =$1
    `,
      [authorId]
    );

    if (linkRes.rowCount === 0) {
      throw new ApiError(500, "Can't find the book data about for author");
    }

    return linkRes.rows;
  } catch (e) {
    throw new ApiError(e.statusCode, e.message);
  }
}

module.exports = { checkSecret, verifyAndUpgrade, insertBook, getAllBooks };
