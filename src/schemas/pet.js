const { Schema, model } = require("mongoose");

const petSchema = new Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    count: { type: Number, default: 0 },
    cooldown: { type: Number, default: 0 }
});

module.exports = model("Pet", petSchema);
