const { Schema, model } = require("mongoose");

const queueChannelSchema = new Schema({
    guildId: { type: String, required: true },
    channelId: { type: String, required: true }
});

module.exports = model("QueueChannel", queueChannelSchema);