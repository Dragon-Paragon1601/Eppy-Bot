require("dotenv").config();

module.exports = {
  token: process.env.token,
  client_ID: process.env.client_ID,
  databaseToken: process.env.databaseToken,
  allowUsers: process.env.allowlist,
  DB_HOST: process.env.DB_HOST,
  DB_USER: process.env.DB_USER,
  DB_PASS: process.env.DB_PASSWORD,
  DB_NAME: process.env.DB_NAME,
  MUSIC_DIR: process.env.MUSIC_DIR,
};
