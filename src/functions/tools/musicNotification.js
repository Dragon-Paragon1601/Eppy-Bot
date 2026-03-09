function createMusicNotificationTools({
  pool,
  logger,
  getGuildNotificationSettings,
  isNotificationTypeEnabled,
}) {
  async function getQueueChannel(guildId) {
    try {
      const [results] = await pool.query(
        "SELECT queue_channel_id FROM queue_channels WHERE guild_id = ?",
        [guildId],
      );
      return results.length > 0 ? results[0].queue_channel_id : null;
    } catch (err) {
      logger.error(`Error fetching queue channel for ${guildId}: ${err}`);
      return null;
    }
  }

  async function sendNotification(guildId, interaction, content, options = {}) {
    try {
      const notificationSettings = await getGuildNotificationSettings(guildId, {
        ensureRow: true,
      });

      if (
        !isNotificationTypeEnabled(
          notificationSettings,
          "queue_notifications_enabled",
        )
      ) {
        return null;
      }

      const channelId = await getQueueChannel(guildId);
      if (channelId) {
        try {
          const ch = await interaction.guild.channels.fetch(channelId);
          if (ch && ch.send) {
            return ch.send({ content, ...options });
          }
        } catch (e) {
          logger.error(
            `Failed to send to configured channel ${channelId}: ${e}`,
          );
        }
      }

      if (interaction.channel && interaction.channel.send) {
        return interaction.channel.send({ content, ...options });
      }
    } catch (err) {
      logger.error(`sendNotification error for ${guildId}: ${err}`);
    }

    return null;
  }

  return {
    getQueueChannel,
    sendNotification,
  };
}

module.exports = {
  createMusicNotificationTools,
};
