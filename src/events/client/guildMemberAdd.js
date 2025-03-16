const { saveAllGuildUsers } = require("../../functions/handlers/handleUsers");
const logger = require("../../logger");

module.exports = {
  name: "guildAvailable",
  async execute(guild) {
    try {
      await saveAllGuildUsers(guild);
    } catch (error) {
      logger.error(`Błąd podczas zapisu użytkowników dla serwera ${guild.name}: ${error}`);
    }
  },
};
