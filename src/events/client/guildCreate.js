const guildAvailableSync = require("./guildAvailable");
const guildMemberSync = require("./guildMemberAdd");
const guildChannelSync = require("./guildTextChannelAviable");
const { saveAllGuildRoles } = require("../../functions/handlers/handleRoles");
const logger = require("../../logger");

module.exports = {
  name: "guildCreate",
  async execute(guild) {
    if (!guild) {
      return;
    }

    try {
      await Promise.allSettled([
        guildAvailableSync.execute(guild),
        guildMemberSync.execute(guild),
        guildChannelSync.execute(guild),
        saveAllGuildRoles(guild),
      ]);
    } catch (error) {
      logger.error(`Błąd guildCreate sync dla ${guild?.id}: ${error}`);
    }
  },
};
