const { Schema, model } = require("mongoose");

const guildSchema = new Schema({
  guildId: { type: String, required: true, unique: true },
  guildName: { type: String, required: true },
  guildIcon: { type: String, default: "None" },
});

module.exports = model("Guild", guildSchema);
