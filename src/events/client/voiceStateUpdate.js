const pool = require("../../events/mysql/connect");
const logger = require("../../logger");
const music = require("../../functions/handlers/handleMusic");

const EMPTY_CHANNEL_TIMEOUT_MS = 15 * 60 * 1000;
const emptyChannelTimers = new Map();

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

function clearEmptyChannelTimer(guildId) {
  const activeTimer = emptyChannelTimers.get(guildId);
  if (activeTimer) {
    clearTimeout(activeTimer);
    emptyChannelTimers.delete(guildId);
  }
}

function countHumanMembers(channel) {
  if (!channel?.members) return 0;
  return channel.members.filter((member) => !member.user?.bot).size;
}

function isBotInChannel(guild) {
  const botChannelId = guild?.members?.me?.voice?.channelId;
  return typeof botChannelId === "string" && botChannelId.length > 0;
}

function evaluateEmptyChannelProtection(guild) {
  if (!guild) return;

  if (!isBotInChannel(guild)) {
    clearEmptyChannelTimer(guild.id);
    return;
  }

  const botVoiceChannel = guild.members.me.voice.channel;
  if (!botVoiceChannel) {
    clearEmptyChannelTimer(guild.id);
    return;
  }

  const humanCount = countHumanMembers(botVoiceChannel);
  if (humanCount > 0) {
    clearEmptyChannelTimer(guild.id);
    return;
  }

  if (emptyChannelTimers.has(guild.id)) {
    return;
  }

  const timer = setTimeout(() => {
    try {
      const refreshedGuild = guild.client.guilds.cache.get(guild.id);
      const refreshedBotChannel = refreshedGuild?.members?.me?.voice?.channel;
      const refreshedHumanCount = countHumanMembers(refreshedBotChannel);

      if (!refreshedBotChannel || refreshedHumanCount > 0) {
        clearEmptyChannelTimer(guild.id);
        return;
      }

      music.stopAndCleanup(guild.id);
      logger.info(
        `Auto-disconnect for guild ${guild.id}: bot stayed alone in voice channel for 15 minutes.`,
      );
    } catch (error) {
      logger.error(`voiceStateUpdate auto-disconnect error: ${error}`);
    } finally {
      clearEmptyChannelTimer(guild.id);
    }
  }, EMPTY_CHANNEL_TIMEOUT_MS);

  emptyChannelTimers.set(guild.id, timer);
  logger.debug(
    `Started 15-minute empty-channel timer for guild ${guild.id} (channel ${botVoiceChannel.id}).`,
  );
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

      evaluateEmptyChannelProtection(newState?.guild || oldState?.guild);

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
