const { Schema, model } = require("mongoose");

const queueSchema = new Schema({
    guildId: { type: String, required: true },
    songs: { type: [String], default: [] }
});

module.exports = model("Queue", queueSchema);