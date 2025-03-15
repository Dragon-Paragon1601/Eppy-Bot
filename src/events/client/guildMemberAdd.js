const { saveAllGuildUsers } = require("../../functions/handlers/handleUsers");
const logger = require("../../logger");

module.exports = {
  name: "guildAvailable",
  async execute(guild) {  // 🔧 Poprawione! Odbieramy guild, nie member
    logger.debug(`Dodawanie użytkowników dla serwera: ${guild.name} (${guild.id})`);
    await saveAllGuildUsers(guild);
  },
};
