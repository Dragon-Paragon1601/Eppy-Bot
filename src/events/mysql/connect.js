// Import MySQL
const mysql = require("mysql2/promise");
const config = require("../../config");

const pool = mysql.createPool({
  host: config.DB_HOST,
  user: config.DB_USER,
  password: config.DB_PASS,
  database: config.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

(async () => {
  try {
    const connection = await pool.getConnection();
    console.log("Połączono z bazą danych MySQL!");
    connection.release();
  } catch (error) {
    console.error("Błąd połączenia z bazą danych MySQL:", error);
  }
})();

module.exports = pool;

