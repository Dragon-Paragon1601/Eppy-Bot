const mongoose = require('mongoose');

const channelSchema = new mongoose.Schema({
  guild_id: { type: String, required: true },
  channel_id: { type: String, required: true },
  channel_name: { type: String, required: true },
  channel_type: { type: String, required: true }, // Przechowuje typ kanału
});

module.exports = mongoose.model('Channel', channelSchema);
