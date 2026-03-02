const guildChannelSync = require("./guildTextChannelAviable");
const logger = require("../../logger");

module.exports = {
  name: "channelUpdate",
  async execute(_oldChannel, newChannel) {
    if (!newChannel?.guild?.id || !newChannel?.id) {
      return;
    }

    try {
      await guildChannelSync.upsertChannel(newChannel);
    } catch (error) {
      logger.error(`Błąd channelUpdate sync dla ${newChannel.id}: ${error}`);
    }
  },
};
