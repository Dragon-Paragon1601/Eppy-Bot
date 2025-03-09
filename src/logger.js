const winston = require("winston");
const path = require("path");
const fs = require("fs");
const DailyRotateFile = require('winston-daily-rotate-file');

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
        new DailyRotateFile({
            filename: path.join(logDir, 'error-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            level: 'error',
            maxSize: '2m',
            maxFiles: '7d'
        }),
        new DailyRotateFile({
            filename: path.join(logDir, 'info-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            level: 'info',
            maxSize: '2m',
            maxFiles: '7d'
        }),
        new DailyRotateFile({
            filename: path.join(logDir, 'debug-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            level: 'debug',
            maxSize: '2m',
            maxFiles: '7d'
        }),
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
