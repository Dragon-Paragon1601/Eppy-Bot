require("dotenv").config();

module.exports = {
  token: process.env.token,
  client_ID: process.env.client_ID,
  databaseToken: process.env.databaseToken,
  spotify_client_ID: process.env.spotify_client_ID,
  spotify_secret: process.env.spotify_secret,
  allowUsers: process.env.allowlist,
  mongoURL: process.env.mongoURL,
};
