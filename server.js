const express = require("express");
const cors = require("cors");
const pool = require("./db");
require("dotenv").config();
const route = require("./routers");
const { ErrorHandler } = require("./middlewares/ErrorHandler");
const morgan = require("morgan");
const logger = require("./utils/logger");

const app = express();

app.use(
  morgan(":method :url :status :res[content-length] - :response-time ms", {
    stream: logger.stream,
  })
);

app.use(express.json());

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use("/api", route);

app.use(ErrorHandler);

const PORT = process.env.PORT || 3000;

async function checkDatabaseConnection() {
  try {
    const client = await pool.connect();
    client.release();
    console.log("Successfully connect with database! 🎶🎶");
  } catch (e) {
    console.log("Error when connect with database!");
  }
}

checkDatabaseConnection().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port=${PORT}`);
  });
});
