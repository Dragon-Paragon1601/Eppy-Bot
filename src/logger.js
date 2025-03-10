const winston = require("winston");
const path = require("path");
const fs = require("fs");
const DailyRotateFile = require("winston-daily-rotate-file");

// Ścieżki do katalogów
const logDir = path.join(__dirname, "../logs");
const archiveDir = path.join(logDir, "archive");

// Tworzenie głównych katalogów
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}
if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
}

// Struktura folderów logów w archive/
const logFolders = ["error", "info", "debug"];
logFolders.forEach((folder) => {
    const archivePath = path.join(archiveDir, folder);
    if (!fs.existsSync(archivePath)) {
        fs.mkdirSync(archivePath, { recursive: true });
    }
});

// Tworzenie loggera
const logger = winston.createLogger({
    level: "debug",
    format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        winston.format.printf(({ level, message, timestamp }) => {
            return `${timestamp} [${level.toUpperCase()}]: ${message}`;
        })
    ),
    transports: [
        // Logi bieżące w logs/
        new winston.transports.File({ filename: path.join(logDir, "error.log"), level: "error" }),
        new winston.transports.File({ filename: path.join(logDir, "info.log"), level: "info" }),
        new winston.transports.File({ filename: path.join(logDir, "debug.log"), level: "debug" }),

        // Archiwizacja logów do logs/archive/{typ_logu}/
        new DailyRotateFile({
            filename: path.join(archiveDir, "error", "error-%DATE%.log"),
            datePattern: "YYYY-MM-DD",
            level: "error",
            maxSize: "1m",
            maxFiles: "7d",
            zippedArchive: false,
        }),
        new DailyRotateFile({
            filename: path.join(archiveDir, "info", "info-%DATE%.log"),
            datePattern: "YYYY-MM-DD",
            level: "info",
            maxSize: "1m",
            maxFiles: "7d",
            zippedArchive: false,
        }),
        new DailyRotateFile({
            filename: path.join(archiveDir, "debug", "debug-%DATE%.log"),
            datePattern: "YYYY-MM-DD",
            level: "debug",
            maxSize: "1m",
            maxFiles: "7d",
            zippedArchive: false,
        }),

        // Konsola
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

// Przekierowanie konsoli do loggera
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

// Eksport loggera
module.exports = logger;

// Testowe logi (sprawdź, czy pliki się tworzą)
logger.info("Testowy log INFO - powinien zapisać się w logs/info.log i logs/archive/info/");
logger.error("Testowy log ERROR - powinien zapisać się w logs/error.log i logs/archive/error/");
logger.debug("Testowy log DEBUG - powinien zapisać się w logs/debug.log i logs/archive/debug/");
