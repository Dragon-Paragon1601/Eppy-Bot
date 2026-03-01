// Import MySQL
const mysql = require("mysql2/promise");
const config = require("../../config");
const logger = require("../../logger");
const { setMySqlConfigured, setMySqlReady } = require("../../database/state");

const mysqlConfigured = !!(
  (config.DB_HOST || "").trim() &&
  (config.DB_USER || "").trim() &&
  (config.DB_NAME || "").trim()
);

setMySqlConfigured(mysqlConfigured);

let pool = null;
let mysqlReady = false;

if (mysqlConfigured) {
  pool = mysql.createPool({
    host: config.DB_HOST,
    user: config.DB_USER,
    password: config.DB_PASS,
    database: config.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
} else {
  logger.warn(
    "MySQL is not configured. Running in no-db mode for MySQL features.",
  );
}

(async () => {
  if (!pool) {
    mysqlReady = false;
    setMySqlReady(false);
    return;
  }

  try {
    const connection = await pool.getConnection();
    mysqlReady = true;
    setMySqlReady(true);
    logger.info("Połączono z bazą danych MySQL!");
    connection.release();
  } catch (error) {
    mysqlReady = false;
    setMySqlReady(false);
    logger.error(`Błąd połączenia z bazą danych MySQL: ${error}`);
  }
})();

async function query(sql, params = []) {
  if (!pool || !mysqlReady) return [[], []];

  try {
    return await pool.query(sql, params);
  } catch (error) {
    mysqlReady = false;
    setMySqlReady(false);
    logger.error(`MySQL query error. Switching to no-db mode: ${error}`);
    return [[], []];
  }
}

function isAvailable() {
  return !!pool && mysqlReady;
}

module.exports = {
  query,
  isAvailable,
};
