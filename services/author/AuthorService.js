const { authorSecret, refreshEI } = require("../../config/jwt");
const pool = require("../../db");
const ApiError = require("../../utils/apiError");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const { generateAccess, generateRefresh } = require("../AuthService");
const supabase = require("../../lib/supabase");

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

async function insertBook(
  userId,
  category,
  subCategories,
  name,
  description,
  fileBuffer,
  originalName
) {
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

    const { rows } = await pool.query(
      `
      With ins as(
      insert into sub_category
      (name)
      select unnest ($1::Text[])
      on conflict (name) do nothing
      returning id,name
      )
      select id,name 
      from ins
      union
      select id,name
      from sub_category
      where name=any($1::Text[])
      `,
      [subCategories]
    );

    const subCatIds = rows.map((r) => r.id);

    const subCateNames = rows.map((r) => r.name);

    const linkPh = subCatIds
      .map((_, idx) => {
        return `($${1},$${idx + 2})`;
      })
      .join(", ");

    const linkRes = await pool.query(
      `
      insert into cat_sub_cat
      (category_id,sub_category_id)
      values ${linkPh}
      on conflict do nothing
      `,
      [categoryId, ...subCatIds]
    );

    if (linkRes.rowCount === 0) {
      throw new ApiError(500, "Link for category with subcategories failed");
    }

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

    if (fileBuffer && originalName) {
      const ext = originalName.split(".").pop();
      const path = `${bookId}.${ext}`;

      const { error: Uperr } = await supabase.storage
        .from("books")
        .upload(path, fileBuffer, {
          contentType: `image/${ext}`,
          upsert: true,
        });

      if (Uperr) throw Uperr;

      const { data, error: UrlErr } = await supabase.storage
        .from("books")
        .getPublicUrl(path);
      if (UrlErr) throw UrlErr;

      const publicUrl = data.publicUrl;

      const imageRes = await pool.query(
        `
      update book
      set image_url = $1
      where id = $2
      `,
        [publicUrl, bookId]
      );

      if (imageRes.rowCount === 0) {
        throw new ApiError(400, "Failed to added image for book");
      }
    }

    const bookSubLinkPh = subCatIds
      .map((_, idx) => {
        return `($${1},$${idx + 2})`;
      })
      .join(", ");

    const bookSubLink = await pool.query(
      `insert into book_sub_category
      (book_id,sub_category_id)
      values
      ${bookSubLinkPh}
      `,
      [bookId, ...subCatIds]
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

    const ResultRes = await pool.query(
      `select id,name,description,image_url
      from book
      where id =$1
      `,
      [bookId]
    );

    const book = ResultRes.rows[0];

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

    return { categoryName, subCateNames, authorName, book };
  } catch (e) {
    throw new ApiError(e.statusCode, e.message);
  }
}

async function getAllBooks(authorId, limit, offset) {
  try {
    // const linkRes = await pool.query(
    //   `
    // select
    // c.name as "category",
    // b.id as "bookId",
    // b.name as "bookName",
    // b.description as "bookDesc",
    // b.created_at as "createdTime",
    // b.image_url as "imageUrl",
    // u.name as "authorName",
    // array_agg(distinct sc.name) as "subCategories"
    // from author_book as ab
    // join users as u on u.id = ab.author_id
    // join book as b on b.id = ab.book_id
    // join book_sub_category as bs on bs.book_id = b.id
    // join sub_category as sc on sc.id = bs.sub_category_id
    // join cat_sub_cat as cs on cs.sub_category_id = sc.id
    // join category as c on c.id = cs.category_id
    // where author_id =$1
    // group by c.name,
    // b.id,b.name,b.description,b.created_at,b.image_url,u.name
    // order by b.created_at desc
    // limit $2 offset $3
    // `
    // ,
    //   [authorId, limit, offset]
    // );

    const linkRes = await pool.query(
      `
      select
      u.name as "authorName",
      c.id as "categoryId",
      c.name as "category",
      b.id as "bookId",
      b.name as "bookName",
      b.description as "description",
      b.image_url as "imageUrl",
      b.created_at as "createdAt",
      b.updated_at as "updatedAt",
      coalesce(
      jsonb_agg(
      jsonb_build_object(
      'subCatId', sc.id,
      'subCategory',sc.name
      )
      ) filter (where sc.id is not null), '[]'
      ) as "subCategories"
      from author_book as ab
      join users as u on u.id = ab.author_id
      join book as b on b.id = ab.book_id
      join book_sub_category as bs on bs.book_id = b.id
      join sub_category as sc on sc.id = bs.sub_category_id
      join cat_sub_cat as csc on csc.sub_category_id = sc.id
      join category as c on c.id = csc.category_id
      where ab.author_id=$1
      group by u.name,c.id,c.name,b.id,b.name,b.description,b.image_url,
      b.created_at,b.updated_at
      limit $2 offset $3
      `,
      [authorId, limit, offset]
    );

    const CountRes = await pool.query(
      `
      select count (distinct b.id) as total
      from users as u
      join author_book as ab on ab.author_id = u.id
      join book as b on b.id = ab.book_id
      where u.id=$1
      `,
      [authorId]
    );

    const link = linkRes.rows;

    const totalCounts = parseInt(CountRes.rows[0].total, 10);

    return { link, totalCounts };
  } catch (e) {
    throw new ApiError(e.statusCode, e.message);
  }
}

async function getAllCategoryAndSubCate() {
  try {
    const { rows } = await pool.query(
      `
      select
      (
      select json_agg(
      jsonb_build_object(
      'categoryId',id,
      'category',name
      )
      ) from category
      ) as categories,
      (
      select json_agg(
      jsonb_build_object(
      'subCateId',id,
      'catId',category_id,
      'subCate',name
      )
      ) from sub_category
      ) as subCategories
      `
    );

    return rows[0];
  } catch (e) {
    throw new ApiError(e.statusCode, e.message);
  }
}

async function insertNewChapter(authorId, bookId, chapter, title, content) {
  try {
    const chapterRes = await pool.query(
      `
      insert into chapters
      (author_id,book_id,chapter,title,content)
      values
      ($1,$2,$3,$4,$5)
      returning *
      `,
      [authorId, bookId, chapter, title, content]
    );

    if (chapterRes.rowCount === 0) {
      return new ApiError(500, `Create new chapter for ${bookId} Failed`);
    }

    return chapterRes.rows[0];
  } catch (e) {
    return new ApiError(e.statusCode, e.message);
  }
}

module.exports = {
  checkSecret,
  verifyAndUpgrade,
  insertBook,
  getAllBooks,
  getAllCategoryAndSubCate,
  insertNewChapter,
};
