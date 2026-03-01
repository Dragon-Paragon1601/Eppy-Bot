const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  PermissionsBitField,
  EmbedBuilder,
} = require("discord.js");
const logger = require("./../../logger");
const pool = require("../../events/mysql/connect");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kicks a member from the server.")
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((option) =>
      option
        .setName("target")
        .setDescription("The member you'd like to kick")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("The reason for kicking the member"),
    ),
  async execute(interaction) {
    const user = interaction.options.getUser("target", true);
    let reason = interaction.options.getString("reason");
    const member = await interaction.guild.members
      .fetch(user.id)
      .catch(() => null);

    if (!reason) reason = "No reason provided.";

    if (
      !interaction.member.permissions.has(PermissionsBitField.Flags.KickMembers)
    ) {
      return await interaction.reply({
        content:
          "❌ You must have the kick members permission to use this command.",
        ephemeral: true,
      });
    }

    if (user.id === interaction.user.id) {
      return interaction.reply({
        content: "❌ You cannot kick yourself.",
        ephemeral: true,
      });
    }

    if (user.id === interaction.client.user.id) {
      return interaction.reply({
        content: "❌ I cannot kick myself.",
        ephemeral: true,
      });
    }

    if (!member) {
      return interaction.reply({
        content: "❌ This user is no longer in the server.",
        ephemeral: true,
      });
    }

    if (
      interaction.guild.ownerId !== interaction.user.id &&
      member.roles.highest.position >= interaction.member.roles.highest.position
    ) {
      return interaction.reply({
        content: "❌ You cannot kick a user with an equal or higher role.",
        ephemeral: true,
      });
    }

    if (!member.kickable) {
      return interaction.reply({
        content:
          "❌ I cannot kick this user (check bot role position and permissions).",
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    let dmSent = true;
    const dmEmbed = new EmbedBuilder()
      .setColor(0xf39c12)
      .setTitle("👢 You Were Kicked")
      .setDescription(`Server: **${interaction.guild.name}**`)
      .addFields(
        { name: "Moderator", value: `${interaction.user.tag}`, inline: true },
        { name: "Reason", value: reason, inline: false },
      )
      .setTimestamp();

    try {
      await user.send({ embeds: [dmEmbed] });
    } catch (error) {
      dmSent = false;
      logger.info(`Could not send pre-kick DM to ${user.id}: ${error}`);
    }

    try {
      const auditReason =
        `${reason} | Moderator: ${interaction.user.tag}`.slice(0, 512);
      await member.kick(auditReason);
    } catch (error) {
      logger.error(`Kick failed for ${user.id}: ${error}`);
      return interaction.editReply({
        content: "❌ Failed to kick this user.",
      });
    }

    const resultEmbed = new EmbedBuilder()
      .setColor(0xe67e22)
      .setTitle("✅ User Kicked")
      .setDescription(`**${user.tag}** has been kicked.`)
      .addFields(
        { name: "Moderator", value: `${interaction.user.tag}`, inline: true },
        { name: "Reason", value: reason, inline: false },
        {
          name: "DM",
          value: dmSent
            ? "✅ Direct message sent"
            : "⚠️ DM not sent (user may have DMs disabled)",
          inline: false,
        },
      )
      .setTimestamp();

    try {
      const [rows] = await pool.query(
        "SELECT kick_notification_channel_id FROM kick_notification_channels WHERE guild_id = ?",
        [interaction.guild.id],
      );

      const targetChannelId = rows.length
        ? rows[0].kick_notification_channel_id
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
      logger.error(`Failed to send kick notification log: ${error}`);
    }

    return interaction.editReply({ embeds: [resultEmbed] });
  },
};
