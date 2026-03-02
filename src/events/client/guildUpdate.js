const guildAvailableSync = require("./guildAvailable");
const logger = require("../../logger");

module.exports = {
  name: "guildUpdate",
  async execute(_oldGuild, newGuild) {
    if (!newGuild) {
      return;
    }

    try {
      await guildAvailableSync.updateGuild(newGuild);
    } catch (error) {
      logger.error(`Błąd guildUpdate sync dla ${newGuild?.id}: ${error}`);
    }
  },
};
