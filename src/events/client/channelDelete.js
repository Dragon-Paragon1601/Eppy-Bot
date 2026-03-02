const guildChannelSync = require("./guildTextChannelAviable");
const logger = require("../../logger");

module.exports = {
  name: "channelDelete",
  async execute(channel) {
    if (!channel?.id) {
      return;
    }

    try {
      await guildChannelSync.removeChannel(channel.id);
    } catch (error) {
      logger.error(`Błąd channelDelete sync dla ${channel?.id}: ${error}`);
    }
  },
};
