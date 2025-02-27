const winston = require("winston");
const path = require("path");
const fs = require("fs");

const logDir = "logs";
const errorDir = path.join(logDir, "error");
const infoDir = path.join(logDir, "info");
const debugDir = path.join(logDir, "debug");

[logDir, errorDir, infoDir, debugDir].forEach((dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});


const logger = winston.createLogger({
    level: "debug",
    format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        winston.format.printf(({ level, message, timestamp }) => {
            return `${timestamp} [${level.toUpperCase()}]: ${message}`;
        })
    ),
    transports: [
        new winston.transports.File({ filename: path.join(errorDir, "error.log"), level: "error" }),
        new winston.transports.File({ filename: path.join(infoDir, "info.log"), level: "info" }),
        new winston.transports.File({ filename: path.join(debugDir, "debug.log"), level: "debug" }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(({ level, message, timestamp }) => {
                    return `${timestamp} [${level.toUpperCase()}]: ${message}`;
                })
            ),
        }),
    ],
});

console.log = (message, ...args) => {
    logger.info(`${message} ${args.join(" ")}`);
};

console.error = (message, ...args) => {
    logger.error(`${message} ${args.join(" ")}`);
};

console.warn = (message, ...args) => {
    logger.warn(`${message} ${args.join(" ")}`);
};

console.debug = (message, ...args) => {
    logger.debug(`${message} ${args.join(" ")}`);
};

module.exports = logger;
