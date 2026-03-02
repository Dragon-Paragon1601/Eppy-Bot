const {
  saveAllGuildUsers,
  upsertGuildMember,
} = require("../../functions/handlers/handleUsers");
const { EmbedBuilder } = require("discord.js");
const pool = require("../../events/mysql/connect");
const logger = require("../../logger");
const {
  getGuildNotificationSettings,
  isNotificationTypeEnabled,
} = require("../../functions/tools/notificationSettings");

module.exports = {
  name: "guildMemberAdd",
  async execute(payload) {
    if (!payload) return;

    const isGuildSyncCall = !!payload.members && !payload.user;

    if (isGuildSyncCall) {
      const guild = payload;
      try {
        await saveAllGuildUsers(guild);
      } catch (error) {
        logger.error(
          `Błąd podczas zapisu użytkowników dla serwera ${guild.name}: ${error}`,
        );
      }
      return;
    }

    const member = payload;
    const guild = member.guild;

    try {
      await upsertGuildMember(member);
    } catch (error) {
      logger.error(
        `Błąd podczas zapisu użytkowników dla serwera ${guild.name}: ${error}`,
      );
    }

    if (!member || !guild || member.user?.bot) {
      return;
    }

    try {
      const settings = await getGuildNotificationSettings(guild.id, {
        ensureRow: true,
      });

      if (
        !isNotificationTypeEnabled(settings, "welcome_notifications_enabled")
      ) {
        return;
      }

      const [rows] = await pool.query(
        "SELECT welcome_channel_id FROM welcome_channels WHERE guild_id = ? LIMIT 1",
        [guild.id],
      );

      const channelId = rows.length ? rows[0].welcome_channel_id : null;
      if (!channelId) {
        return;
      }

      const channel = await guild.channels.fetch(channelId).catch(() => null);
      if (!channel || !channel.isTextBased()) {
        return;
      }

      const welcomeEmbed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle("👋 Welcome")
        .setDescription(
          `Welcome <@${member.id}> to **${guild.name}**! Have fun ✨`,
        )
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp();

      await channel.send({ embeds: [welcomeEmbed] });
    } catch (error) {
      logger.error(`Welcome notification error for ${guild?.id}: ${error}`);
    }
  },
};
