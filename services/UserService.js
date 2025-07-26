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

async function getAllAuthor() {
  try {
    const roleRes = await pool.query(
      `
      select id from roles
      where name = $1
      `,
      ["author"]
    );

    if (roleRes.rowCount === 0) {
      throw new ApiError(500, "Can't find the Role_id of author role");
    }

    const roleId = roleRes.rows[0].id;

    const authorRes = await pool.query(
      `
      select 
      a.id as "authorId",
      a.name as "authorName"
      from user_roles as ur
      join users as a on a.id = ur.user_id
      join roles as r on r.id = ur.role_id
      where r.id=$1
      `,
      [roleId]
    );

    return authorRes.rows;
  } catch (e) {
    throw new ApiError(e.statusCode, e.message);
  }
}

async function getAllAuthorsBooks() {
  try {
    const bookRes = await pool.query(
      `
      select
      u.id as "authorId",
      u.name as "authorName",
      b.id as "bookId",
      b.name as "bookName",
      b.description as "description",
      b.created_at as "createdAt",
      sc.id as "subCatId",
      sc.name as "subCategory",
      c.id as "categoryId",
      c.name as "category"
      from roles as r
      join user_roles as ur on ur.role_id = r.id
      join users as u on u.id = ur.user_id
      join author_book as ab on ab.author_id = u.id
      join book as b on b.id = ab.book_id
      join book_sub_category as bs on bs.book_id = ab.book_id
      join sub_category as sc on sc.id = bs.sub_category_id
      join category as c on c.id = sc.category_id
      where r.name = $1
      order by b.created_at desc
      `,
      ["author"]
    );

    return bookRes.rows;
  } catch (e) {
    throw new ApiError(e.statusCode, e.message);
  }
}

async function getBooksByAuthor(authorId) {
  try {
    const bookRes = await pool.query(
      `
      select 
      u.id as "authorId",
      u.name as "authorName",
      coalesce(
      json_agg(
      jsonb_build_object(
      'bookId', b.id,
      'bookName' ,b.name,
      'description',b.description,
      'createdAt',b.created_at,
      'subCatId',s.id,
      'subCategory',s.name,
      'categoryId',c.id,
      'category', c.name
      )
      order by b.created_at desc
      ) filter (where b.id is not null), '[]'
      ) as books
      from author_book as ab
      join users as u on u.id = ab.author_id
      join book as b on b.id = ab.book_id
      join book_sub_category as bs on bs.book_id = b.id
      join sub_category as s on s.id = bs.sub_category_id
      join category as c on c.id = s.category_id
      where ab.author_id =$1
      group by u.id, u.name
      `,
      [authorId]
    );

    return bookRes.rows[0];
  } catch (e) {
    throw new ApiError(e.statusCode, e.message);
  }
}

module.exports = {
  userInfo,
  getAllAuthor,
  getAllAuthorsBooks,
  getBooksByAuthor,
};
