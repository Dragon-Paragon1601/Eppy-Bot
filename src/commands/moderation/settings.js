const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} = require("discord.js");
const pool = require("../../events/mysql/connect");
const config = require("../../config");
const logger = require("../../logger");
const {
  DEFAULT_NOTIFICATION_SETTINGS,
  ensureNotificationSettingsTable,
  getGuildNotificationSettings,
  upsertGuildNotificationSettings,
} = require("../../functions/tools/notificationSettings");

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
    .addChannelOption((option) =>
      option
        .setName("ban_notification_channel")
        .setDescription("Channel for ban notifications (set to change)")
        .setRequired(false),
    )
    .addChannelOption((option) =>
      option
        .setName("kick_notification_channel")
        .setDescription("Channel for kick notifications (set to change)")
        .setRequired(false),
    )
    .addRoleOption((option) =>
      option
        .setName("notification_role")
        .setDescription("Role to ping in generic notifications (set to change)")
        .setRequired(false),
    )
    .addRoleOption((option) =>
      option
        .setName("update_notification_role")
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
    .addBooleanOption((option) =>
      option
        .setName("clear_ban_notification_channel")
        .setDescription("Clear ban_notification_channel mapping")
        .setRequired(false),
    )
    .addBooleanOption((option) =>
      option
        .setName("clear_kick_notification_channel")
        .setDescription("Clear kick_notification_channel mapping")
        .setRequired(false),
    )
    .addBooleanOption((option) =>
      option
        .setName("notifications_enabled")
        .setDescription("Enable/disable all notifications category")
        .setRequired(false),
    )
    .addBooleanOption((option) =>
      option
        .setName("queue_notifications_enabled")
        .setDescription("Enable/disable queue notifications")
        .setRequired(false),
    )
    .addBooleanOption((option) =>
      option
        .setName("welcome_notifications_enabled")
        .setDescription("Enable/disable welcome notifications")
        .setRequired(false),
    )
    .addBooleanOption((option) =>
      option
        .setName("global_notifications_enabled")
        .setDescription("Enable/disable generic notification broadcasts")
        .setRequired(false),
    )
    .addBooleanOption((option) =>
      option
        .setName("update_notifications_enabled")
        .setDescription("Enable/disable update notifications")
        .setRequired(false),
    )
    .addBooleanOption((option) =>
      option
        .setName("ban_notifications_enabled")
        .setDescription("Enable/disable ban notifications")
        .setRequired(false),
    )
    .addBooleanOption((option) =>
      option
        .setName("kick_notifications_enabled")
        .setDescription("Enable/disable kick notifications")
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const memberId = interaction.user.id;

    const ensureColumn = async (table, definition) => {
      const columnNameMatch = String(definition)
        .trim()
        .match(/^`?([a-zA-Z0-9_]+)`?/);
      const columnName = columnNameMatch ? columnNameMatch[1] : null;
      if (!columnName) {
        throw new Error(`Invalid column definition: ${definition}`);
      }

      const existingColumns = await getTableColumns(table);
      if (existingColumns.has(columnName)) {
        return;
      }

      await pool.query(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
    };

    const formatChannelDisplay = async (channelId) => {
      if (!channelId) return "⚪ Not set";

      try {
        const channel = await interaction.client.channels.fetch(channelId);
        if (!channel || !channel.isTextBased()) {
          return `⚠️ Missing or non-text channel (${channelId})`;
        }

        return `✅ <#${channelId}>`;
      } catch {
        return `⚠️ Missing channel (${channelId})`;
      }
    };

    const formatRoleDisplay = (roleId) => {
      if (!roleId) return "⚪ Not set";

      const role = interaction.guild.roles.cache.get(roleId);
      if (role) {
        return `✅ <@&${roleId}>`;
      }

      return `⚠️ Missing role (${roleId})`;
    };

    const formatSelectedAt = (value) => {
      if (!value) return "—";
      const unix = Math.floor(new Date(value).getTime() / 1000);
      if (!Number.isFinite(unix) || unix <= 0) return "—";
      return `<t:${unix}:F>\n<t:${unix}:R>`;
    };

    const formatSelectedBy = (userId) => {
      if (!userId) return "—";
      return `<@${userId}> (${userId})`;
    };

    const getTableColumns = async (tableName) => {
      try {
        const [rows] = await pool.query(
          "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?",
          [config.DB_NAME, tableName],
        );
        return new Set(rows.map((row) => String(row.COLUMN_NAME || "")));
      } catch (err) {
        logger.error(`settings getTableColumns error (${tableName}): ${err}`);
        return new Set();
      }
    };

    const getMappingRow = async (tableName, idColumn) => {
      const cols = await getTableColumns(tableName);
      const hasSelectedAt = cols.has("selected_at");
      const hasSelectedBy = cols.has("selected_by");

      const selectSelectedAt = hasSelectedAt
        ? "selected_at"
        : "NULL AS selected_at";
      const selectSelectedBy = hasSelectedBy
        ? "selected_by"
        : "NULL AS selected_by";

      const [rows] = await pool.query(
        `SELECT ${idColumn}, ${selectSelectedAt}, ${selectSelectedBy} FROM ${tableName} WHERE guild_id = ?`,
        [guildId],
      );

      if (!rows.length) {
        return {
          id: null,
          selectedAt: null,
          selectedBy: null,
        };
      }

      return {
        id: rows[0][idColumn] || null,
        selectedAt: rows[0].selected_at || null,
        selectedBy: rows[0].selected_by || null,
      };
    };

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
    const banNotificationChannel = interaction.options.getChannel(
      "ban_notification_channel",
    );
    const kickNotificationChannel = interaction.options.getChannel(
      "kick_notification_channel",
    );
    const notificationRole = interaction.options.getRole("notification_role");
    const updateNotificationRole = interaction.options.getRole(
      "update_notification_role",
    );
    const clearQueue = interaction.options.getBoolean("clear_queue_channel");
    const clearNotification = interaction.options.getBoolean(
      "clear_notification_channel",
    );
    const clearWelcome = interaction.options.getBoolean(
      "clear_welcome_channel",
    );
    const clearBanNotification = interaction.options.getBoolean(
      "clear_ban_notification_channel",
    );
    const clearKickNotification = interaction.options.getBoolean(
      "clear_kick_notification_channel",
    );
    const notificationsEnabledOption = interaction.options.getBoolean(
      "notifications_enabled",
    );
    const queueNotificationsEnabledOption = interaction.options.getBoolean(
      "queue_notifications_enabled",
    );
    const welcomeNotificationsEnabledOption = interaction.options.getBoolean(
      "welcome_notifications_enabled",
    );
    const globalNotificationsEnabledOption = interaction.options.getBoolean(
      "global_notifications_enabled",
    );
    const updateNotificationsEnabledOption = interaction.options.getBoolean(
      "update_notifications_enabled",
    );
    const banNotificationsEnabledOption = interaction.options.getBoolean(
      "ban_notifications_enabled",
    );
    const kickNotificationsEnabledOption = interaction.options.getBoolean(
      "kick_notifications_enabled",
    );

    try {
      await pool.query(
        "CREATE TABLE IF NOT EXISTS ban_notification_channels (guild_id VARCHAR(32) NOT NULL PRIMARY KEY, ban_notification_channel_id VARCHAR(32) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
      );
      await pool.query(
        "CREATE TABLE IF NOT EXISTS kick_notification_channels (guild_id VARCHAR(32) NOT NULL PRIMARY KEY, kick_notification_channel_id VARCHAR(32) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
      );
      await pool.query(
        "CREATE TABLE IF NOT EXISTS update_notification_roles (guild_id VARCHAR(32) NOT NULL PRIMARY KEY, notification_role_id VARCHAR(32) NOT NULL, selected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, selected_by VARCHAR(32) NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
      );
      await pool.query(
        "CREATE TABLE IF NOT EXISTS notification_roles (guild_id VARCHAR(32) NOT NULL PRIMARY KEY, notification_role_id VARCHAR(32) NOT NULL, selected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, selected_by VARCHAR(32) NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
      );
      await ensureNotificationSettingsTable();

      await ensureColumn(
        "queue_channels",
        "selected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
      );
      await ensureColumn("queue_channels", "selected_by VARCHAR(32) NULL");

      await ensureColumn(
        "notification_channels",
        "selected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
      );
      await ensureColumn(
        "notification_channels",
        "selected_by VARCHAR(32) NULL",
      );

      await ensureColumn(
        "welcome_channels",
        "selected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
      );
      await ensureColumn("welcome_channels", "selected_by VARCHAR(32) NULL");

      await ensureColumn(
        "update_notification_channels",
        "selected_by VARCHAR(32) NULL",
      );
      await ensureColumn(
        "update_notification_roles",
        "selected_by VARCHAR(32) NULL",
      );
      await ensureColumn("notification_roles", "selected_by VARCHAR(32) NULL");

      await ensureColumn(
        "ban_notification_channels",
        "selected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
      );
      await ensureColumn(
        "ban_notification_channels",
        "selected_by VARCHAR(32) NULL",
      );

      await ensureColumn(
        "kick_notification_channels",
        "selected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
      );
      await ensureColumn(
        "kick_notification_channels",
        "selected_by VARCHAR(32) NULL",
      );

      // If no options provided, show current mappings
      if (
        !queueChannel &&
        !notificationChannel &&
        !welcomeChannel &&
        !updateNotificationChannel &&
        !banNotificationChannel &&
        !kickNotificationChannel &&
        !notificationRole &&
        !updateNotificationRole &&
        !clearQueue &&
        !clearNotification &&
        !clearWelcome &&
        !clearBanNotification &&
        !clearKickNotification &&
        notificationsEnabledOption === null &&
        queueNotificationsEnabledOption === null &&
        welcomeNotificationsEnabledOption === null &&
        globalNotificationsEnabledOption === null &&
        updateNotificationsEnabledOption === null &&
        banNotificationsEnabledOption === null &&
        kickNotificationsEnabledOption === null
      ) {
        const queueMap = await getMappingRow(
          "queue_channels",
          "queue_channel_id",
        );
        const notificationMap = await getMappingRow(
          "notification_channels",
          "notification_channel_id",
        );
        const welcomeMap = await getMappingRow(
          "welcome_channels",
          "welcome_channel_id",
        );
        const updateMap = await getMappingRow(
          "update_notification_channels",
          "update_notification_channel_id",
        );
        const roleMap = await getMappingRow(
          "notification_roles",
          "notification_role_id",
        );
        const updateRoleMap = await getMappingRow(
          "update_notification_roles",
          "notification_role_id",
        );
        const banMap = await getMappingRow(
          "ban_notification_channels",
          "ban_notification_channel_id",
        );
        const kickMap = await getMappingRow(
          "kick_notification_channels",
          "kick_notification_channel_id",
        );

        const qId = queueMap.id;
        const qSelectedAt = queueMap.selectedAt;
        const qSelectedBy = queueMap.selectedBy;
        const nId = notificationMap.id;
        const nSelectedAt = notificationMap.selectedAt;
        const nSelectedBy = notificationMap.selectedBy;
        const wId = welcomeMap.id;
        const wSelectedAt = welcomeMap.selectedAt;
        const wSelectedBy = welcomeMap.selectedBy;
        const uId = updateMap.id;
        const uSelectedAt = updateMap.selectedAt;
        const uSelectedBy = updateMap.selectedBy;
        const rId = roleMap.id;
        const rSelectedAt = roleMap.selectedAt;
        const rSelectedBy = roleMap.selectedBy;
        const urId = updateRoleMap.id;
        const urSelectedAt = updateRoleMap.selectedAt;
        const urSelectedBy = updateRoleMap.selectedBy;
        const bId = banMap.id;
        const bSelectedAt = banMap.selectedAt;
        const bSelectedBy = banMap.selectedBy;
        const kId = kickMap.id;
        const kSelectedAt = kickMap.selectedAt;
        const kSelectedBy = kickMap.selectedBy;

        const queueDisplay = await formatChannelDisplay(qId);
        const notificationDisplay = await formatChannelDisplay(nId);
        const welcomeDisplay = await formatChannelDisplay(wId);
        const updateDisplay = await formatChannelDisplay(uId);
        const banDisplay = await formatChannelDisplay(bId);
        const kickDisplay = await formatChannelDisplay(kId);
        const roleDisplay = formatRoleDisplay(rId);
        const updateRoleDisplay = formatRoleDisplay(urId);
        const notificationSettings = await getGuildNotificationSettings(
          guildId,
          {
            ensureRow: true,
            selectedBy: memberId,
          },
        );

        const toggleSummary = [
          `Category: ${notificationSettings.notifications_enabled ? "✅ ON" : "⛔ OFF"}`,
          `Queue: ${notificationSettings.queue_notifications_enabled ? "✅ ON" : "⛔ OFF"}`,
          `Ban: ${notificationSettings.ban_notifications_enabled ? "✅ ON" : "⛔ OFF"}`,
          `Kick: ${notificationSettings.kick_notifications_enabled ? "✅ ON" : "⛔ OFF"}`,
          `Welcome: ${notificationSettings.welcome_notifications_enabled ? "✅ ON" : "⛔ OFF"}`,
          `Notification: ${notificationSettings.notification_channel_enabled ? "✅ ON" : "⛔ OFF"}`,
          `Update: ${notificationSettings.update_notification_channel_enabled ? "✅ ON" : "⛔ OFF"}`,
        ].join("\n");

        const settingsEmbed = new EmbedBuilder()
          .setColor(0x3498db)
          .setTitle("⚙️ Current Server Settings")
          .setDescription(
            "Current channel and role mappings for this server. Use `/settings` options to update them.",
          )
          .addFields(
            {
              name: "Queue Channel",
              value: `${queueDisplay}\nSelected: ${formatSelectedAt(qSelectedAt)}\nBy: ${formatSelectedBy(qSelectedBy)}`,
              inline: false,
            },
            {
              name: "Notification Channel",
              value: `${notificationDisplay}\nSelected: ${formatSelectedAt(nSelectedAt)}\nBy: ${formatSelectedBy(nSelectedBy)}`,
              inline: false,
            },
            {
              name: "Welcome Channel",
              value: `${welcomeDisplay}\nSelected: ${formatSelectedAt(wSelectedAt)}\nBy: ${formatSelectedBy(wSelectedBy)}`,
              inline: false,
            },
            {
              name: "Update Notification Channel",
              value: `${updateDisplay}\nSelected: ${formatSelectedAt(uSelectedAt)}\nBy: ${formatSelectedBy(uSelectedBy)}`,
              inline: false,
            },
            {
              name: "Notification Role",
              value: `${roleDisplay}\nSelected: ${formatSelectedAt(rSelectedAt)}\nBy: ${formatSelectedBy(rSelectedBy)}`,
              inline: false,
            },
            {
              name: "Update Notification Role",
              value: `${updateRoleDisplay}\nSelected: ${formatSelectedAt(urSelectedAt)}\nBy: ${formatSelectedBy(urSelectedBy)}`,
              inline: false,
            },
            {
              name: "Ban Notification Channel",
              value: `${banDisplay}\nSelected: ${formatSelectedAt(bSelectedAt)}\nBy: ${formatSelectedBy(bSelectedBy)}`,
              inline: false,
            },
            {
              name: "Kick Notification Channel",
              value: `${kickDisplay}\nSelected: ${formatSelectedAt(kSelectedAt)}\nBy: ${formatSelectedBy(kSelectedBy)}`,
              inline: false,
            },
            {
              name: "Notification Toggles",
              value: `${toggleSummary}\n\nDefaults: Queue/Ban/Kick ON with fallback to command channel. Welcome/Notification/Update OFF and require channel to work.`,
              inline: false,
            },
          )
          .setFooter({
            text: `Guild ID: ${guildId}`,
          })
          .setTimestamp();

        return interaction.reply({
          embeds: [settingsEmbed],
          ephemeral: true,
        });
      }

      const currentNotificationMap = await getMappingRow(
        "notification_channels",
        "notification_channel_id",
      );
      const currentWelcomeMap = await getMappingRow(
        "welcome_channels",
        "welcome_channel_id",
      );
      const currentUpdateMap = await getMappingRow(
        "update_notification_channels",
        "update_notification_channel_id",
      );

      const currentNotificationSettings = await getGuildNotificationSettings(
        guildId,
        {
          ensureRow: true,
          selectedBy: memberId,
        },
      );

      const nextNotificationSettings = {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        ...currentNotificationSettings,
      };

      if (notificationsEnabledOption !== null) {
        nextNotificationSettings.notifications_enabled =
          notificationsEnabledOption;
      }
      if (queueNotificationsEnabledOption !== null) {
        nextNotificationSettings.queue_notifications_enabled =
          queueNotificationsEnabledOption;
      }
      if (welcomeNotificationsEnabledOption !== null) {
        nextNotificationSettings.welcome_notifications_enabled =
          welcomeNotificationsEnabledOption;
      }
      if (globalNotificationsEnabledOption !== null) {
        nextNotificationSettings.notification_channel_enabled =
          globalNotificationsEnabledOption;
      }
      if (updateNotificationsEnabledOption !== null) {
        nextNotificationSettings.update_notification_channel_enabled =
          updateNotificationsEnabledOption;
      }
      if (banNotificationsEnabledOption !== null) {
        nextNotificationSettings.ban_notifications_enabled =
          banNotificationsEnabledOption;
      }
      if (kickNotificationsEnabledOption !== null) {
        nextNotificationSettings.kick_notifications_enabled =
          kickNotificationsEnabledOption;
      }

      const effectiveNotificationChannelId = clearNotification
        ? null
        : notificationChannel
          ? notificationChannel.id
          : currentNotificationMap.id;
      const effectiveWelcomeChannelId = clearWelcome
        ? null
        : welcomeChannel
          ? welcomeChannel.id
          : currentWelcomeMap.id;
      const effectiveUpdateChannelId = updateNotificationChannel
        ? updateNotificationChannel.id
        : currentUpdateMap.id;

      if (
        nextNotificationSettings.notifications_enabled &&
        nextNotificationSettings.notification_channel_enabled &&
        !effectiveNotificationChannelId
      ) {
        return interaction.reply({
          content:
            "❌ `notification_channel` is required when generic notifications are enabled.",
          ephemeral: true,
        });
      }

      if (
        nextNotificationSettings.notifications_enabled &&
        nextNotificationSettings.welcome_notifications_enabled &&
        !effectiveWelcomeChannelId
      ) {
        return interaction.reply({
          content:
            "❌ `welcome_channel` is required when welcome notifications are enabled.",
          ephemeral: true,
        });
      }

      if (
        nextNotificationSettings.notifications_enabled &&
        nextNotificationSettings.update_notification_channel_enabled &&
        !effectiveUpdateChannelId
      ) {
        return interaction.reply({
          content:
            "❌ `update_notification_channel` is required when update notifications are enabled.",
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
          "INSERT INTO queue_channels (guild_id, queue_channel_id, selected_at, selected_by) VALUES (?, ?, CURRENT_TIMESTAMP, ?) ON DUPLICATE KEY UPDATE queue_channel_id = VALUES(queue_channel_id), selected_at = CURRENT_TIMESTAMP, selected_by = VALUES(selected_by)",
          [guildId, queueChannel.id, memberId],
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
          "INSERT INTO notification_channels (guild_id, notification_channel_id, selected_at, selected_by) VALUES (?, ?, CURRENT_TIMESTAMP, ?) ON DUPLICATE KEY UPDATE notification_channel_id = VALUES(notification_channel_id), selected_at = CURRENT_TIMESTAMP, selected_by = VALUES(selected_by)",
          [guildId, notificationChannel.id, memberId],
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
          "INSERT INTO welcome_channels (guild_id, welcome_channel_id, selected_at, selected_by) VALUES (?, ?, CURRENT_TIMESTAMP, ?) ON DUPLICATE KEY UPDATE welcome_channel_id = VALUES(welcome_channel_id), selected_at = CURRENT_TIMESTAMP, selected_by = VALUES(selected_by)",
          [guildId, welcomeChannel.id, memberId],
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
          "INSERT INTO update_notification_channels (guild_id, update_notification_channel_id, selected_at, selected_by) VALUES (?, ?, CURRENT_TIMESTAMP, ?) ON DUPLICATE KEY UPDATE update_notification_channel_id = VALUES(update_notification_channel_id), selected_at = CURRENT_TIMESTAMP, selected_by = VALUES(selected_by)",
          [guildId, updateNotificationChannel.id, memberId],
        );
      }

      // notification_role
      if (notificationRole) {
        await pool.query(
          "INSERT INTO notification_roles (guild_id, notification_role_id, selected_at, selected_by) VALUES (?, ?, CURRENT_TIMESTAMP, ?) ON DUPLICATE KEY UPDATE notification_role_id = VALUES(notification_role_id), selected_at = CURRENT_TIMESTAMP, selected_by = VALUES(selected_by)",
          [guildId, notificationRole.id, memberId],
        );
      }

      // update_notification_role
      if (updateNotificationRole) {
        await pool.query(
          "INSERT INTO update_notification_roles (guild_id, notification_role_id, selected_at, selected_by) VALUES (?, ?, CURRENT_TIMESTAMP, ?) ON DUPLICATE KEY UPDATE notification_role_id = VALUES(notification_role_id), selected_at = CURRENT_TIMESTAMP, selected_by = VALUES(selected_by)",
          [guildId, updateNotificationRole.id, memberId],
        );
      }

      // ban_notification_channel
      if (clearBanNotification) {
        await pool.query(
          "DELETE FROM ban_notification_channels WHERE guild_id = ?",
          [guildId],
        );
      } else if (banNotificationChannel) {
        if (
          banNotificationChannel.type !== ChannelType.GuildText &&
          !banNotificationChannel.isTextBased()
        ) {
          return interaction.reply({
            content: "❌ ban_notification_channel must be a text channel.",
            ephemeral: true,
          });
        }

        await pool.query(
          "INSERT INTO ban_notification_channels (guild_id, ban_notification_channel_id, selected_at, selected_by) VALUES (?, ?, CURRENT_TIMESTAMP, ?) ON DUPLICATE KEY UPDATE ban_notification_channel_id = VALUES(ban_notification_channel_id), selected_at = CURRENT_TIMESTAMP, selected_by = VALUES(selected_by)",
          [guildId, banNotificationChannel.id, memberId],
        );
      }

      // kick_notification_channel
      if (clearKickNotification) {
        await pool.query(
          "DELETE FROM kick_notification_channels WHERE guild_id = ?",
          [guildId],
        );
      } else if (kickNotificationChannel) {
        if (
          kickNotificationChannel.type !== ChannelType.GuildText &&
          !kickNotificationChannel.isTextBased()
        ) {
          return interaction.reply({
            content: "❌ kick_notification_channel must be a text channel.",
            ephemeral: true,
          });
        }

        await pool.query(
          "INSERT INTO kick_notification_channels (guild_id, kick_notification_channel_id, selected_at, selected_by) VALUES (?, ?, CURRENT_TIMESTAMP, ?) ON DUPLICATE KEY UPDATE kick_notification_channel_id = VALUES(kick_notification_channel_id), selected_at = CURRENT_TIMESTAMP, selected_by = VALUES(selected_by)",
          [guildId, kickNotificationChannel.id, memberId],
        );
      }

      await upsertGuildNotificationSettings(
        guildId,
        nextNotificationSettings,
        memberId,
      );

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
