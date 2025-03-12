const pool = require("../mysql/connect");
const logger = require("./../../logger");

module.exports = {
  name: "guildCreate",
  once: true,
  async execute(guild) {
    try {
        console.log("GuildCreate event wywołany");
        console.log("Dane o guildzie:", guild);  // Sprawdź, co dokładnie dostajesz w obiekcie guild

        // Inne logi, żeby zobaczyć dostępne dane
        console.log(`Guild name: ${guild.name}`);
        console.log(`Guild ID: ${guild.id}`);
        console.log(`Guild owner ID: ${guild.ownerId}`);
        // Możesz także wyświetlić inne dane dostępne w guild, aby zobaczyć, co jest dostępne
    } catch (error) {
        logger.error(`Błąd przy dodawaniu wpisu do tabeli 'ready': ${error}`);
      }
  },
};

  