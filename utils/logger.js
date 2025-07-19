const { createLogger, format, transports } = require("winston");
const chalk = require("chalk").default;

const customFormat = format.printf(({ level, timestamp, meta, message }) => {
  const lvl = (() => {
    switch (level) {
      case "error":
        return chalk.red(level);
      case "debug":
        return chalk.magenta(level);
      case "warn":
        return chalk.yellow(level);
      case "info":
        return chalk.green(level);
      case "http":
        return chalk.cyan(level);
      default:
        return level;
    }
  })();
  const metaLog = meta ? `\n${JSON.stringify(meta, null, 2)}` : "";
  return `${chalk.dim(timestamp)} ${lvl}: ${message}${metaLog}`;
});

const logger = createLogger({
  level: "debug",
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD-HH-mm-ss" }),
    format.splat(),
    format.errors({ stack: true }),
    customFormat
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: "logs/error.log", level: "error" }),
    new transports.File({ filename: "logs/combined.log" }),
  ],
});

logger.stream = {
  write: (msg) => logger.http(msg.trim()),
};

module.exports = logger;
