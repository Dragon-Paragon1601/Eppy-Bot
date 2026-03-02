const pool = require("../../events/mysql/connect");
const logger = require("../../logger");

let tableReady = false;
let tablePromise = null;

async function ensureVoiceTable() {
  if (tableReady) return;
  if (tablePromise) {
    await tablePromise;
    return;
  }

  tablePromise = pool
    .query(
      "CREATE TABLE IF NOT EXISTS guild_user_voice_states (guild_id VARCHAR(32) NOT NULL, user_id VARCHAR(32) NOT NULL, channel_id VARCHAR(32) NOT NULL, channel_name VARCHAR(255) NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (guild_id, user_id), KEY idx_guild_voice_channel (guild_id, channel_id), KEY idx_guild_voice_updated (updated_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
    )
    .then(() => {
      tableReady = true;
    })
    .finally(() => {
      tablePromise = null;
    });

  await tablePromise;
}

module.exports = {
  name: "voiceStateUpdate",
  async execute(oldState, newState) {
    try {
      const guildId = newState?.guild?.id || oldState?.guild?.id;
      const userId = newState?.id || oldState?.id;
      if (!guildId || !userId) return;

      await ensureVoiceTable();

      const oldChannelId = oldState?.channelId || null;
      const newChannelId = newState?.channelId || null;

      if (oldChannelId === newChannelId) {
        return;
      }

      const channelId = newChannelId;
      const channelName = newState?.channel?.name || null;

      if (!channelId) {
        await pool.query(
          "DELETE FROM guild_user_voice_states WHERE guild_id = ? AND user_id = ?",
          [guildId, userId],
        );
        return;
      }

      await pool.query(
        "INSERT INTO guild_user_voice_states (guild_id, user_id, channel_id, channel_name) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE channel_id = VALUES(channel_id), channel_name = VALUES(channel_name)",
        [guildId, userId, channelId, channelName],
      );
    } catch (error) {
      logger.error(`voiceStateUpdate sync error: ${error}`);
    }
  },
};
