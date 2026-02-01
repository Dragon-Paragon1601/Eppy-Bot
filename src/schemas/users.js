const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  guild_id: { type: String, required: true },
  user_id: { type: String, required: true },
  admin_prem: { type: Number, required: true, min: 0, max: 8 },
  username: { type: String, required: true }, // Dodane pole z nazwą użytkownika
  guild_name: { type: String, required: true }, // Dodane pole z nazwą serwera
  guild_icon: { type: String, required: false }, // Dodane pole z ikoną serwera (opcjonalne)
  // The following fields store the user's display name and guild info
  // `username`: user's username at the time of save
  // `guild_name`: the server name
  // `guild_icon`: optional server icon URL
});

module.exports = mongoose.model("User", userSchema);
