const winston = require("winston");
const path = require("path");
const fs = require("fs");

const logDir = "logs";


[logDir].forEach((dir) => {
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
        new winston.transports.File({ filename: path.join(logDir, "error.log"), level: "error" }),
        new winston.transports.File({ filename: path.join(logDir, "info.log"), level: "info" }),
        new winston.transports.File({ filename: path.join(logDir, "debug.log"), level: "debug" }),
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
