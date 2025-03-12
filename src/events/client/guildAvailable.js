const pool = require("../mysql/connect");
const logger = require("./../../logger");

module.exports = {
  name: "guildAvailable",
  async execute(guild) {
    try {
      const [rows] = await pool.query("SELECT id FROM servers WHERE id = ?", [guild.id]);

      if (rows.length === 0) {
        await pool.query("INSERT INTO servers (id, name, owner_id, icon) VALUES (?, ?, ?, ?)", [
          guild.id,
          guild.name,
          guild.ownerId,
          guild.icon || null, // Jeśli brak ikony, zapisuje `null`
        ]);
        logger.debug(`Dodano serwer: ${guild.name}`);
      } else {
        await pool.query("UPDATE servers SET name = ?, icon = ? WHERE id = ?", [
          guild.name,
          guild.icon || null,
          guild.id,
        ]);
        logger.debug(`Zaktualizowano serwer: ${guild.name}`);
      }
    } catch (error) {
      logger.error(`Błąd zapisu serwera: ${error}`);
    }
  },
};
