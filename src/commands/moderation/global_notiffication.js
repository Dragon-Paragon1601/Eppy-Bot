const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const pool = require("../../events/mysql/connect");
const config = require("../../config");
const logger = require("../../logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("global_notiffication")
    .setDescription(
      "Send notification message to all configured notification channels",
    )
    .addStringOption((option) =>
      option
        .setName("message")
        .setDescription("Notification message content (manual mode)")
        .setRequired(false)
        .setMaxLength(2000),
    )
    .addAttachmentOption((option) =>
      option
        .setName("message_file")
        .setDescription("Text file (.txt) with notification content")
        .setRequired(false),
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
        .setName("ping")
        .setDescription("Ping @everyone in each target channel")
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

    const manualMessage = interaction.options.getString("message");
    const messageFile = interaction.options.getAttachment("message_file");
    const title =
      interaction.options.getString("title") || "📢 Eppy-Bot Notice";
    const ping = interaction.options.getBoolean("ping") ?? false;
    const dryRun = interaction.options.getBoolean("dry_run") ?? false;

    await interaction.deferReply({ ephemeral: true });

    try {
      if (!manualMessage && !messageFile) {
        return interaction.editReply({
          content:
            "❌ Provide either `message` (manual) or `message_file` (.txt).",
        });
      }

      if (manualMessage && messageFile) {
        return interaction.editReply({
          content: "❌ Use one input mode only: `message` OR `message_file`.",
        });
      }

      let message = "";

      if (messageFile) {
        const isTextFile =
          (messageFile.contentType || "").startsWith("text/") ||
          (messageFile.name || "").toLowerCase().endsWith(".txt");

        if (!isTextFile) {
          return interaction.editReply({
            content:
              "❌ `message_file` must be a text file (`.txt` or text/* content type).",
          });
        }

        const fileResponse = await fetch(messageFile.url);
        if (!fileResponse.ok) {
          return interaction.editReply({
            content: `❌ Could not read attached file (HTTP ${fileResponse.status}).`,
          });
        }

        const rawFromFile = await fileResponse.text();
        message = rawFromFile
          .replace(/\r\n/g, "\n")
          .replaceAll("\\n", "\n")
          .replaceAll("<br>", "\n")
          .replaceAll("<br/>", "\n")
          .trim();
      } else {
        message = manualMessage
          .replaceAll("\\n", "\n")
          .replaceAll("<br>", "\n")
          .replaceAll("<br/>", "\n")
          .trim();
      }

      if (!message.length) {
        return interaction.editReply({
          content: "❌ Message content is empty.",
        });
      }

      if (message.length > 4096) {
        return interaction.editReply({
          content:
            "❌ Message is too long for embed description (max 4096 chars).",
        });
      }

      const [rows] = await pool.query(
        "SELECT guild_id, notification_channel_id FROM notification_channels",
      );

      if (!rows.length) {
        return interaction.editReply({
          content: "ℹ️ No servers have `notification_channel` configured.",
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0xffb020)
        .setTitle(title)
        .setDescription(message)
        .addFields({
          name: "Published",
          value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
          inline: false,
        })
        .setFooter({
          text: `Notification by ${interaction.user.tag}`,
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
            row.notification_channel_id,
          );

          if (!channel || !channel.isTextBased()) {
            skipped += 1;
            continue;
          }

          const mentionText = ping ? "@everyone" : "";
          const allowedMentions = ping
            ? { parse: ["everyone"] }
            : { parse: [] };

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
              `guild ${row.guild_id}, channel ${row.notification_channel_id}: ${err.message}`,
            );
          }
          logger.error(
            `notiffication send error guild=${row.guild_id} channel=${row.notification_channel_id}: ${err}`,
          );
        }
      }

      const modeText = dryRun
        ? "🧪 Dry run finished."
        : "✅ Notification broadcast finished.";
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
      logger.error(`notiffication command error: ${err}`);
      return interaction.editReply({
        content: `❌ Error: ${err.message}`,
      });
    }
  },
};
