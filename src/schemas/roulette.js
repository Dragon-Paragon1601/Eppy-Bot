const { Schema, model } = require("mongoose");

const rouletteSchema = new Schema({
    guildId: String,
    userId: String,
    lives: { type: Number, default: 3 },
    currency: { type: Number, default: 0 },
    lastPlayed: { type: Date, default: null },
});

module.exports = model("Roulette", rouletteSchema);