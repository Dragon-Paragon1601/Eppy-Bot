const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  guild_id: { type: String, required: true },
  user_id: { type: String, required: true },
  admin_prem: { type: Number, required: true, min: 0, max: 8 },
  username: { type: String, required: true }, // Dodane pole z nazwą użytkownika
  guild_name: { type: String, required: true }, // Dodane pole z nazwą serwera
  guild_icon: { type: String, required: false }, // Dodane pole z ikoną serwera (opcjonalne)
});

module.exports = mongoose.model("User", userSchema);
