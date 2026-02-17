const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const pool = require("../../events/mysql/connect");
const config = require("../../config");
const logger = require("../../logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("global_update")
    .setDescription("Send global update message to configured update channels")
    .addStringOption((option) =>
      option
        .setName("message")
        .setDescription("Update message content")
        .setRequired(true)
        .setMaxLength(2000),
    )
    .addStringOption((option) =>
      option
        .setName("title")
        .setDescription("Embed title")
        .setRequired(false)
        .setMaxLength(120),
    )
    .addBooleanOption((option) =>
      option
        .setName("ping_role")
        .setDescription(
          "Ping configured notification role (fallback: @everyone)",
        )
        .setRequired(false),
    )
    .addBooleanOption((option) =>
      option
        .setName("dry_run")
        .setDescription("Simulate sending without posting any message")
        .setRequired(false),
    ),

  async execute(interaction) {
    const allowed = (config.allowUsers || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (!allowed.includes(interaction.user.id)) {
      return interaction.reply({
        content: "🚫 You don't have permissions",
        ephemeral: true,
      });
    }

    const message = interaction.options.getString("message", true);
    const title =
      interaction.options.getString("title") || "🚀 Eppy-Bot — New Update";
    const pingRole = interaction.options.getBoolean("ping_role") ?? false;
    const dryRun = interaction.options.getBoolean("dry_run") ?? false;

    await interaction.deferReply({ ephemeral: true });

    try {
      const [rows] = await pool.query(
        "SELECT c.guild_id, c.update_notification_channel_id, r.notification_role_id FROM update_notification_channels c LEFT JOIN update_notification_roles r ON c.guild_id = r.guild_id",
      );

      if (!rows.length) {
        return interaction.editReply({
          content:
            "ℹ️ No servers have `update_notification_channel` configured.",
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(title)
        .setDescription(message)
        .addFields({
          name: "Published",
          value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
          inline: false,
        })
        .setFooter({
          text: `Update by ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTimestamp();

      let success = 0;
      let failed = 0;
      let skipped = 0;
      const errors = [];

      for (const row of rows) {
        try {
          const channel = await interaction.client.channels.fetch(
            row.update_notification_channel_id,
          );

          if (!channel || !channel.isTextBased()) {
            skipped += 1;
            continue;
          }

          const guild = interaction.client.guilds.cache.get(row.guild_id);

          let mentionText = "";
          let allowedMentions = { parse: [] };

          if (pingRole) {
            if (row.notification_role_id && guild) {
              const role = guild.roles.cache.get(row.notification_role_id);
              if (role) {
                mentionText = `<@&${row.notification_role_id}>`;
                allowedMentions = { parse: ["roles"] };
              } else {
                mentionText = "@everyone";
                allowedMentions = { parse: ["everyone"] };
              }
            } else {
              mentionText = "@everyone";
              allowedMentions = { parse: ["everyone"] };
            }
          }

          if (!dryRun) {
            await channel.send({
              content: mentionText,
              embeds: [embed],
              allowedMentions,
            });
          }

          success += 1;
        } catch (err) {
          failed += 1;
          if (errors.length < 10) {
            errors.push(
              `guild ${row.guild_id}, channel ${row.update_notification_channel_id}: ${err.message}`,
            );
          }
          logger.error(
            `global_update send error guild=${row.guild_id} channel=${row.update_notification_channel_id}: ${err}`,
          );
        }
      }

      const modeText = dryRun
        ? "🧪 Dry run finished."
        : "✅ Global update finished.";
      const successLabel = dryRun ? "Would send" : "Sent";

      let summary =
        `${modeText}\n` +
        `• ${successLabel}: ${success}\n` +
        `• Failed: ${failed}\n` +
        `• Skipped: ${skipped}\n` +
        `• Total: ${rows.length}`;

      if (errors.length) {
        summary += `\n\nFirst errors:\n${errors.map((e) => `- ${e}`).join("\n")}`;
      }

      return interaction.editReply({ content: summary });
    } catch (err) {
      logger.error(`global_update command error: ${err}`);
      return interaction.editReply({
        content: `❌ Error: ${err.message}`,
      });
    }
  },
};
