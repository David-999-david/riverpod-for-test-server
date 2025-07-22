require("dotenv").config();

module.exports = {
  accessTk: process.env.ACCESS_TK,
  accessEI: parseInt(process.env.ACCESS_EI, 10),
  refreshTk: process.env.REFRESH_TK,
  refreshEI: parseInt(process.env.REFRESH_EI, 10),
  authorSecret: process.env.SECRET_AUTHOR,
};
