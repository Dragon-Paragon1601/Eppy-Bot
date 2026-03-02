const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { exec } = require("child_process");
const pool = require("../../events/mysql/connect");
const config = require("../../config");
const logger = require("../../logger");
const {
  ensureNotificationSettingsTable,
} = require("../../functions/tools/notificationSettings");

const gitPullNoticeTemplates = [
  "Eppy is preparing an update in {delay} seconds.",
  "Eppy will pull latest changes in {delay} seconds.",
  "Eppy is syncing code from repository in {delay} seconds.",
  "Eppy is applying new updates in {delay} seconds.",
  "Eppy will refresh scripts from git in {delay} seconds.",
  "Eppy is getting latest repository changes in {delay} seconds.",
  "Eppy will perform a code update in {delay} seconds.",
  "Eppy is preparing auto-reload update in {delay} seconds.",
  "Eppy will sync with origin in {delay} seconds.",
  "Eppy is updating itself from git in {delay} seconds.",
  "Eppy is fetching newest bot changes in {delay} seconds.",
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("gitpull")
    .setDescription("Run git pull (tylko dla allowUsers)")
    .addBooleanOption((option) =>
      option
        .setName("notify")
        .setDescription(
          "Send automatic global notification to configured notification channels",
        )
        .setRequired(false),
    )
    .addBooleanOption((option) =>
      option
        .setName("ping")
        .setDescription("Ping @everyone in notifications")
        .setRequired(false),
    )
    .addIntegerOption((option) =>
      option
        .setName("delay")
        .setDescription("Delay git pull by X seconds")
        .setMinValue(0)
        .setMaxValue(3600)
        .setRequired(false),
    ),

  async execute(interaction) {
    const allowedUsers = (config.allowUsers || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (!allowedUsers.includes(interaction.user.id)) {
      return interaction.reply({
        content: "🚫 You don't have permissions",
        ephemeral: true,
      });
    }

    const notify = interaction.options.getBoolean("notify") ?? false;
    const ping = interaction.options.getBoolean("ping") ?? false;
    const delaySeconds = interaction.options.getInteger("delay") ?? 0;

    await interaction.deferReply({ ephemeral: true });

    let notifySummary = "";

    if (notify) {
      try {
        await ensureNotificationSettingsTable();

        const [rows] = await pool.query(
          "SELECT c.guild_id, c.notification_channel_id FROM notification_channels c INNER JOIN guild_notification_settings s ON c.guild_id = s.guild_id WHERE s.notifications_enabled = 1 AND s.notification_channel_enabled = 1",
        );

        const template =
          gitPullNoticeTemplates[
            Math.floor(Math.random() * gitPullNoticeTemplates.length)
          ];
        const noticeText = template.replaceAll("{delay}", String(delaySeconds));
        const actionAtUnix = Math.floor(Date.now() / 1000) + delaySeconds;

        const embed = new EmbedBuilder()
          .setColor(0xffa500)
          .setTitle("⚠️ Planned bot update")
          .setDescription(noticeText)
          .addFields(
            {
              name: "Update in",
              value: delaySeconds > 0 ? `${delaySeconds} seconds` : "now",
              inline: true,
            },
            {
              name: "ETA",
              value: `<t:${actionAtUnix}:R>`,
              inline: true,
            },
          )
          .setFooter({ text: `Triggered by ${interaction.user.tag}` })
          .setTimestamp();

        let sent = 0;
        let failed = 0;
        let skipped = 0;

        for (const row of rows) {
          try {
            const channel = await interaction.client.channels.fetch(
              row.notification_channel_id,
            );

            if (!channel || !channel.isTextBased()) {
              skipped += 1;
              continue;
            }

            await channel.send({
              content: ping ? "@everyone" : "",
              embeds: [embed],
              allowedMentions: ping ? { parse: ["everyone"] } : { parse: [] },
            });

            sent += 1;
          } catch (err) {
            failed += 1;
            logger.error(
              `gitpull notify error guild=${row.guild_id} channel=${row.notification_channel_id}: ${err}`,
            );
          }
        }

        notifySummary = `\n🔔 Notify: on (sent ${sent}, failed ${failed}, skipped ${skipped})`;
      } catch (err) {
        logger.error(`gitpull notify global error: ${err}`);
        notifySummary = `\n🔔 Notify: failed (${err.message})`;
      }
    } else {
      notifySummary = "\n🔔 Notify: off";
    }

    await interaction.editReply(
      `🛰️ Git pull scheduled in ${delaySeconds} second(s).${notifySummary}`,
    );

    setTimeout(() => {
      exec("git pull", { cwd: process.cwd() }, (error, stdout, stderr) => {
        if (error) {
          logger.error(`gitpull command error: ${error.message}`);
          return;
        }

        if (stderr && stderr.trim().length > 0) {
          logger.error(`gitpull stderr: ${stderr}`);
          return;
        }

        logger.info(`gitpull success: ${stdout}`);
      });
    }, delaySeconds * 1000);
  },
};
