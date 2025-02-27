const { Schema, model } = require("mongoose");
const guildSchema = new Schema({
  _id: Schema.Types.ObjectId,
  guildId: String,
  guildName: String,
  guildIcone: { type: String, require: false },
});

module.exports = new model("Guild", guildSchema, "guilds");
