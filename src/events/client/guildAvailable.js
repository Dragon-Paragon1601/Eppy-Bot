const pool = require("../mysql/connect");
const logger = require("./../../logger");

module.exports = {
  name: "guildAvailable",
  async execute(guild) {
    try {
      // Sprawdzenie, czy rekord już istnieje w bazie
      const [rows] = await pool.query("SELECT id FROM servers WHERE id = ?", [guild.id]);
      if (rows.length === 0) {
        // Dodanie nowego serwera
        await pool.query("INSERT INTO servers (id, name, owner_id) VALUES (?, ?, ?)", [
          guild.id,
          guild.name,
          guild.ownerId
        ]);
        logger.debug(`Dodano serwer: ${guild.name}`);
      } else {
        logger.debug("Serwer już istnieje w bazie");
      }
    } catch (error) {
      logger.error(`Błąd zapisu serwera: ${error}`);
    }
  },
};
