const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require("discord.js");
const pool = require("../../events/mysql/connect");
const config = require("../../config");
const logger = require("../../logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("settings")
    .setDescription("Server settings (admin or allowUsers)")
    .addChannelOption((option) =>
      option
        .setName("queue_channel")
        .setDescription("Channel for queue notifications (set to change)")
        .setRequired(false),
    )
    .addChannelOption((option) =>
      option
        .setName("notification_channel")
        .setDescription("Channel for generic notifications (set to change)")
        .setRequired(false),
    )
    .addChannelOption((option) =>
      option
        .setName("welcome_channel")
        .setDescription("Channel for welcome messages (set to change)")
        .setRequired(false),
    )
    .addChannelOption((option) =>
      option
        .setName("update_notification_channel")
        .setDescription("Channel for update notifications (set to change)")
        .setRequired(false),
    )
    .addRoleOption((option) =>
      option
        .setName("notification_role")
        .setDescription("Role to ping in update notifications (set to change)")
        .setRequired(false),
    )
    .addBooleanOption((option) =>
      option
        .setName("clear_queue_channel")
        .setDescription("Clear queue_channel mapping")
        .setRequired(false),
    )
    .addBooleanOption((option) =>
      option
        .setName("clear_notification_channel")
        .setDescription("Clear notification_channel mapping")
        .setRequired(false),
    )
    .addBooleanOption((option) =>
      option
        .setName("clear_welcome_channel")
        .setDescription("Clear welcome_channel mapping")
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const memberId = interaction.user.id;

    // allow if admin or in allowUsers env
    const isAdmin = interaction.member.permissions.has(
      PermissionFlagsBits.Administrator,
    );
    const allowed = (config.allowUsers || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!isAdmin && !allowed.includes(memberId)) {
      return interaction.reply({
        content:
          "❌ You need to be an administrator or in allowlist to use this command.",
        ephemeral: true,
      });
    }

    const queueChannel = interaction.options.getChannel("queue_channel");
    const notificationChannel = interaction.options.getChannel(
      "notification_channel",
    );
    const welcomeChannel = interaction.options.getChannel("welcome_channel");
    const updateNotificationChannel = interaction.options.getChannel(
      "update_notification_channel",
    );
    const notificationRole = interaction.options.getRole("notification_role");
    const clearQueue = interaction.options.getBoolean("clear_queue_channel");
    const clearNotification = interaction.options.getBoolean(
      "clear_notification_channel",
    );
    const clearWelcome = interaction.options.getBoolean(
      "clear_welcome_channel",
    );

    try {
      // If no options provided, show current mappings
      if (
        !queueChannel &&
        !notificationChannel &&
        !welcomeChannel &&
        !updateNotificationChannel &&
        !notificationRole &&
        !clearQueue &&
        !clearNotification &&
        !clearWelcome
      ) {
        const [qRows] = await pool.query(
          "SELECT queue_channel_id FROM queue_channels WHERE guild_id = ?",
          [guildId],
        );
        const [nRows] = await pool.query(
          "SELECT notification_channel_id FROM notification_channels WHERE guild_id = ?",
          [guildId],
        );
        const [wRows] = await pool.query(
          "SELECT welcome_channel_id FROM welcome_channels WHERE guild_id = ?",
          [guildId],
        );
        const [uRows] = await pool.query(
          "SELECT update_notification_channel_id, selected_at FROM update_notification_channels WHERE guild_id = ?",
          [guildId],
        );
        const [rRows] = await pool.query(
          "SELECT notification_role_id, selected_at FROM update_notification_roles WHERE guild_id = ?",
          [guildId],
        );

        const q = qRows.length ? qRows[0].queue_channel_id : "(not set)";
        const n = nRows.length ? nRows[0].notification_channel_id : "(not set)";
        const w = wRows.length ? wRows[0].welcome_channel_id : "(not set)";
        const u = uRows.length
          ? `${uRows[0].update_notification_channel_id} (selected_at: ${uRows[0].selected_at})`
          : "(not set)";
        const r = rRows.length
          ? `${rRows[0].notification_role_id} (selected_at: ${rRows[0].selected_at})`
          : "(not set)";

        return interaction.reply({
          content: `Current channels:\n• queue_channel: ${q}\n• notification_channel: ${n}\n• welcome_channel: ${w}\n• update_notification_channel: ${u}\n• notification_role: ${r}`,
          ephemeral: true,
        });
      }

      // queue_channel
      if (clearQueue) {
        await pool.query("DELETE FROM queue_channels WHERE guild_id = ?", [
          guildId,
        ]);
      } else if (queueChannel) {
        if (
          queueChannel.type !== ChannelType.GuildText &&
          !queueChannel.isTextBased()
        )
          return interaction.reply({
            content: "❌ queue_channel must be a text channel.",
            ephemeral: true,
          });
        await pool.query(
          "INSERT INTO queue_channels (guild_id, queue_channel_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE queue_channel_id = VALUES(queue_channel_id)",
          [guildId, queueChannel.id],
        );
      }

      // notification_channel
      if (clearNotification) {
        await pool.query(
          "DELETE FROM notification_channels WHERE guild_id = ?",
          [guildId],
        );
      } else if (notificationChannel) {
        if (
          notificationChannel.type !== ChannelType.GuildText &&
          !notificationChannel.isTextBased()
        )
          return interaction.reply({
            content: "❌ notification_channel must be a text channel.",
            ephemeral: true,
          });
        await pool.query(
          "INSERT INTO notification_channels (guild_id, notification_channel_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE notification_channel_id = VALUES(notification_channel_id)",
          [guildId, notificationChannel.id],
        );
      }

      // welcome_channel
      if (clearWelcome) {
        await pool.query("DELETE FROM welcome_channels WHERE guild_id = ?", [
          guildId,
        ]);
      } else if (welcomeChannel) {
        if (
          welcomeChannel.type !== ChannelType.GuildText &&
          !welcomeChannel.isTextBased()
        )
          return interaction.reply({
            content: "❌ welcome_channel must be a text channel.",
            ephemeral: true,
          });
        await pool.query(
          "INSERT INTO welcome_channels (guild_id, welcome_channel_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE welcome_channel_id = VALUES(welcome_channel_id)",
          [guildId, welcomeChannel.id],
        );
      }

      // update_notification_channel
      if (updateNotificationChannel) {
        if (
          updateNotificationChannel.type !== ChannelType.GuildText &&
          !updateNotificationChannel.isTextBased()
        )
          return interaction.reply({
            content: "❌ update_notification_channel must be a text channel.",
            ephemeral: true,
          });

        await pool.query(
          "INSERT INTO update_notification_channels (guild_id, update_notification_channel_id, selected_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE update_notification_channel_id = VALUES(update_notification_channel_id), selected_at = CURRENT_TIMESTAMP",
          [guildId, updateNotificationChannel.id],
        );
      }

      // notification_role
      if (notificationRole) {
        await pool.query(
          "INSERT INTO update_notification_roles (guild_id, notification_role_id, selected_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE notification_role_id = VALUES(notification_role_id), selected_at = CURRENT_TIMESTAMP",
          [guildId, notificationRole.id],
        );
      }

      return interaction.reply({
        content: "✅ Settings updated.",
        ephemeral: true,
      });
    } catch (err) {
      logger.error(`settings command error: ${err}`);
      return interaction.reply({
        content: `❌ Error: ${err.message}`,
        ephemeral: true,
      });
    }
  },
};
