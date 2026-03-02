const pool = require("../mysql/connect");
const logger = require("./../../logger");

module.exports = {
  name: "guildAvailable",
  async execute(guild) {
    try {
      const [rows] = await pool.query("SELECT id FROM servers WHERE id = ?", [
        guild.id,
      ]);

      if (rows.length === 0) {
        // Dodanie serwera, jeśli nie istnieje
        await pool.query(
          "INSERT INTO servers (id, name, owner_id, icon) VALUES (?, ?, ?, ?)",
          [
            guild.id,
            guild.name,
            guild.ownerId,
            guild.iconURL() || null, // Jeśli brak ikony, zapisuje `null`
          ],
        );
      } else {
        // Zaktualizowanie danych serwera, jeśli już istnieje
        await pool.query("UPDATE servers SET name = ?, icon = ? WHERE id = ?", [
          guild.name,
          guild.iconURL() || null,
          guild.id,
        ]);
      }
    } catch (error) {
      logger.error(`Błąd zapisu serwera: ${error}`);
    }
  },

  // Funkcja do usunięcia serwera
  async deleteGuild(guildId) {
    try {
      const [rows] = await pool.query("SELECT id FROM servers WHERE id = ?", [
        guildId,
      ]);
      if (rows.length > 0) {
        const tablesWithGuildId = [
          "channels",
          "users",
          "guild_roles",
          "queue_channels",
          "notification_channels",
          "welcome_channels",
          "update_notification_channels",
          "ban_notification_channels",
          "kick_notification_channels",
          "notification_roles",
          "update_notification_roles",
          "guild_notification_settings",
          "temp_bans",
        ];

        for (const tableName of tablesWithGuildId) {
          await pool.query(`DELETE FROM ${tableName} WHERE guild_id = ?`, [
            guildId,
          ]);
        }

        await pool.query("DELETE FROM servers WHERE id = ?", [guildId]);
      } else {
      }
    } catch (error) {
      logger.error(`Błąd usuwania serwera: ${error}`);
    }
  },

  // Funkcja do aktualizacji danych serwera
  async updateGuild(guild) {
    try {
      const [rows] = await pool.query("SELECT id FROM servers WHERE id = ?", [
        guild.id,
      ]);
      if (rows.length > 0) {
        // Zaktualizowanie istniejącego serwera
        await pool.query(
          "UPDATE servers SET name = ?, owner_id = ?, icon = ? WHERE id = ?",
          [guild.name, guild.ownerId, guild.iconURL() || null, guild.id],
        );
      } else {
      }
    } catch (error) {
      logger.error(`Błąd aktualizacji serwera: ${error}`);
    }
  },
};
