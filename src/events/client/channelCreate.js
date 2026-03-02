const guildChannelSync = require("./guildTextChannelAviable");
const logger = require("../../logger");

module.exports = {
  name: "channelCreate",
  async execute(channel) {
    if (!channel?.guild?.id || !channel?.id) {
      return;
    }

    try {
      await guildChannelSync.upsertChannel(channel);
    } catch (error) {
      logger.error(`Błąd channelCreate sync dla ${channel.guild.id}: ${error}`);
    }
  },
};
