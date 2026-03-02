const guildAvailableSync = require("./guildAvailable");
const logger = require("../../logger");

module.exports = {
  name: "guildDelete",
  async execute(guild) {
    if (!guild?.id) {
      return;
    }

    try {
      await guildAvailableSync.deleteGuild(guild.id);
    } catch (error) {
      logger.error(`Błąd guildDelete cleanup dla ${guild.id}: ${error}`);
    }
  },
};
