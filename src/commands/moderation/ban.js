const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  PermissionsBitField,
  EmbedBuilder,
} = require("discord.js");
const logger = require("./../../logger");
const pool = require("../../events/mysql/connect");
const {
  scheduleTempBan,
  parseDurationToMs,
  formatDuration,
} = require("../../database/tempBanStore");

const MAX_DELETE_DAYS = 7;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Bans a member from the server.")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((option) =>
      option
        .setName("target")
        .setDescription("The member you'd like to ban")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("time")
        .setDescription("Temporary ban duration (e.g. 30m, 2h, 7d)")
        .setRequired(false),
    )
    .addIntegerOption((option) =>
      option
        .setName("delete_days")
        .setDescription("How many days of messages to delete (0-7)")
        .setMinValue(0)
        .setMaxValue(MAX_DELETE_DAYS),
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("The reason for banning the member"),
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser("target", true);
    const timeInput = interaction.options.getString("time");
    let reason = interaction.options.getString("reason");
    const deleteDays = interaction.options.getInteger("delete_days") ?? 0;

    if (!reason) reason = "No reason provided.";

    if (
      !interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers)
    ) {
      return await interaction.reply({
        content:
          "❌ You must have the ban members permission to use this command.",
        ephemeral: true,
      });
    }

    if (targetUser.id === interaction.user.id) {
      return interaction.reply({
        content: "❌ You cannot ban yourself.",
        ephemeral: true,
      });
    }

    if (targetUser.id === interaction.client.user.id) {
      return interaction.reply({
        content: "❌ I cannot ban myself.",
        ephemeral: true,
      });
    }

    const targetMember = await interaction.guild.members
      .fetch(targetUser.id)
      .catch(() => null);

    if (
      targetMember &&
      interaction.guild.ownerId !== interaction.user.id &&
      targetMember.roles.highest.position >=
        interaction.member.roles.highest.position
    ) {
      return interaction.reply({
        content: "❌ You cannot ban a user with an equal or higher role.",
        ephemeral: true,
      });
    }

    if (targetMember && !targetMember.bannable) {
      return interaction.reply({
        content:
          "❌ I cannot ban this user (check bot role position and permissions).",
        ephemeral: true,
      });
    }

    let durationMs = null;
    if (timeInput) {
      durationMs = parseDurationToMs(timeInput);
      if (!durationMs) {
        return interaction.reply({
          content:
            "❌ Invalid `time` format. Use values like `30m`, `2h`, or `7d`.",
          ephemeral: true,
        });
      }
    }

    await interaction.deferReply();

    let dmSent = true;
    const durationLabel = durationMs ? formatDuration(durationMs) : "Permanent";

    const dmEmbed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle("🔨 You Were Banned")
      .setDescription(`Server: **${interaction.guild.name}**`)
      .addFields(
        { name: "Moderator", value: `${interaction.user.tag}`, inline: true },
        { name: "Reason", value: reason, inline: false },
        {
          name: "Ban Type",
          value: durationMs ? "Temporary" : "Permanent",
          inline: true,
        },
        { name: "Duration", value: durationLabel, inline: true },
      )
      .setTimestamp();

    try {
      await targetUser.send({ embeds: [dmEmbed] });
    } catch (error) {
      dmSent = false;
      logger.info(`Could not send pre-ban DM to ${targetUser.id}: ${error}`);
    }

    const auditReason = `${reason} | Moderator: ${interaction.user.tag}`.slice(
      0,
      512,
    );

    try {
      if (targetMember) {
        await targetMember.ban({
          deleteMessageSeconds: deleteDays * 24 * 60 * 60,
          reason: auditReason,
        });
      } else {
        await interaction.guild.members.ban(targetUser.id, {
          deleteMessageSeconds: deleteDays * 24 * 60 * 60,
          reason: auditReason,
        });
      }
    } catch (error) {
      logger.error(`Ban failed for ${targetUser.id}: ${error}`);
      return interaction.editReply({
        content: "❌ Failed to ban this user.",
      });
    }

    let tempBanPersisted = true;
    if (durationMs) {
      try {
        await scheduleTempBan(interaction.client, {
          guildId: interaction.guild.id,
          userId: targetUser.id,
          moderatorId: interaction.user.id,
          reason,
          expiresAt: Date.now() + durationMs,
        });
      } catch (error) {
        tempBanPersisted = false;
        logger.error(
          `Failed to schedule temporary unban for ${targetUser.id}: ${error}`,
        );
      }
    }

    const resultEmbed = new EmbedBuilder()
      .setColor(0xc0392b)
      .setTitle("✅ User Banned")
      .setDescription(`**${targetUser.tag}** has been banned.`)
      .addFields(
        { name: "Moderator", value: `${interaction.user.tag}`, inline: true },
        { name: "Reason", value: reason, inline: false },
        {
          name: "Message Deletion",
          value: `${deleteDays} day(s)`,
          inline: true,
        },
        {
          name: "Ban Type",
          value: durationMs ? "Temporary" : "Permanent",
          inline: true,
        },
        { name: "Duration", value: durationLabel, inline: true },
        {
          name: "DM",
          value: dmSent
            ? "✅ Direct message sent"
            : "⚠️ DM not sent (user may have DMs disabled)",
          inline: false,
        },
        ...(durationMs
          ? [
              {
                name: "Tempban Persistence",
                value: tempBanPersisted
                  ? "✅ Saved in database"
                  : "⚠️ Failed to save in database (auto-unban may not survive restart)",
                inline: false,
              },
            ]
          : []),
      )
      .setTimestamp();

    try {
      const [rows] = await pool.query(
        "SELECT ban_notification_channel_id FROM ban_notification_channels WHERE guild_id = ?",
        [interaction.guild.id],
      );

      const targetChannelId = rows.length
        ? rows[0].ban_notification_channel_id
        : null;

      let logChannel = interaction.channel;
      if (targetChannelId) {
        const configuredChannel = await interaction.client.channels
          .fetch(targetChannelId)
          .catch(() => null);

        if (configuredChannel && configuredChannel.isTextBased()) {
          logChannel = configuredChannel;
        }
      }

      if (
        logChannel &&
        logChannel.isTextBased() &&
        logChannel.id !== interaction.channelId
      ) {
        await logChannel.send({ embeds: [resultEmbed] });
      }
    } catch (error) {
      logger.error(`Failed to send ban notification log: ${error}`);
    }

    return interaction.editReply({ embeds: [resultEmbed] });
  },
};
