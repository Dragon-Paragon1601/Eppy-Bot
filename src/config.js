require("dotenv").config();

module.exports = {
  token: process.env.token,
  client_ID: process.env.client_ID,
  client_Secret: process.env.client_Secret,
  databaseToken: process.env.databaseToken,
  spotify_client_ID: process.env.spotify_client_ID,
  spotify_secret: process.env.spotify_secret,
  allowUsers: process.env.allowlist,
  SESSION_SECRET: process.env.SESSION_SECRET,
  DB_HOST: process.env.DB_HOST,
  DB_USER: process.env.DB_USER,
  DB_PASS: process.env.DB_PASSWORD,
  DB_NAME: process.env.DB_NAME,
};
