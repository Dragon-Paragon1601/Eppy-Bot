const pool = require("../../events/mysql/connect");
const logger = require("./../../logger");

async function upsertGuildChannel(channel) {
  if (!channel?.guild || !channel?.id) {
    return;
  }

  await pool.query(
    "INSERT INTO channels (guild_id, channel_id, channel_name, channel_type) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE channel_name = VALUES(channel_name), channel_type = VALUES(channel_type), updated_at = CURRENT_TIMESTAMP",
    [channel.guild.id, channel.id, channel.name, String(channel.type)],
  );
}

async function removeGuildChannel(channelId) {
  if (!channelId) {
    return;
  }

  await pool.query("DELETE FROM channels WHERE channel_id = ?", [channelId]);
}

module.exports = {
  name: "guildAvailable",
  async execute(guild) {
    try {
      // Pobieramy wszystkie kanały z serwera (tekstowe, głosowe itd.)
      const allChannels = guild.channels.cache;

      for (const channel of allChannels.values()) {
        await upsertGuildChannel(channel);
      }
    } catch (error) {
      logger.error(`Błąd zapisu kanałów: ${error}`);
    }
  },

  // Usuwanie kanału
  async deleteChannel(channelId) {
    try {
      await removeGuildChannel(channelId);
    } catch (error) {
      logger.error(`Błąd usuwania kanału: ${error}`);
    }
  },

  // Aktualizacja nazwy kanału
  async updateChannelName(channelId, newName) {
    try {
      await pool.query(
        "UPDATE channels SET channel_name = ?, updated_at = CURRENT_TIMESTAMP WHERE channel_id = ?",
        [newName, channelId],
      );
    } catch (error) {
      logger.error(`Błąd aktualizacji nazwy kanału: ${error}`);
    }
  },

  async upsertChannel(channel) {
    try {
      await upsertGuildChannel(channel);
    } catch (error) {
      logger.error(`Błąd upsert kanału: ${error}`);
    }
  },

  async removeChannel(channelId) {
    try {
      await removeGuildChannel(channelId);
    } catch (error) {
      logger.error(`Błąd remove kanału: ${error}`);
    }
  },
};
