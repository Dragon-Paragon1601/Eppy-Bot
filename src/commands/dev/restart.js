const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { exec } = require("child_process");
const pool = require("../../events/mysql/connect");
const logger = require("./../../logger");
const config = require("./../../config");

const restartNoticeTemplates = [
  "Eppy has to rest for a little bit in {delay} seconds.",
  "Eppy is taking a short nap in {delay} seconds.",
  "Eppy will be back after a tiny break in {delay} seconds.",
  "Eppy needs a quick reboot in {delay} seconds.",
  "Eppy is recharging for a moment in {delay} seconds.",
  "Eppy is stepping away for a short rest in {delay} seconds.",
  "Eppy will refresh and return in {delay} seconds.",
  "Eppy is taking a small power break in {delay} seconds.",
  "Eppy will restart and be right back in {delay} seconds.",
  "Eppy is getting a quick tune-up in {delay} seconds.",
  "Eppy needs a little pause before coming back in {delay} seconds.",
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("restart")
    .setDescription("Restart bot (tylko dla allowUsers)")
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
        .setDescription("Delay restart by X seconds")
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
        const [rows] = await pool.query(
          "SELECT guild_id, notification_channel_id FROM notification_channels",
        );

        const template =
          restartNoticeTemplates[
            Math.floor(Math.random() * restartNoticeTemplates.length)
          ];
        const noticeText = template.replaceAll("{delay}", String(delaySeconds));
        const restartAtUnix = Math.floor(Date.now() / 1000) + delaySeconds;

        const embed = new EmbedBuilder()
          .setColor(0xffa500)
          .setTitle("⚠️ Planned bot restart")
          .setDescription(noticeText)
          .addFields(
            {
              name: "Restart in",
              value: delaySeconds > 0 ? `${delaySeconds} seconds` : "now",
              inline: true,
            },
            {
              name: "ETA",
              value: `<t:${restartAtUnix}:R>`,
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
              `restart notify error guild=${row.guild_id} channel=${row.notification_channel_id}: ${err}`,
            );
          }
        }

        notifySummary = `\n🔔 Notify: on (sent ${sent}, failed ${failed}, skipped ${skipped})`;
      } catch (err) {
        logger.error(`restart notify global error: ${err}`);
        notifySummary = `\n🔔 Notify: failed (${err.message})`;
      }
    } else {
      notifySummary = "\n🔔 Notify: off";
    }

    await interaction.editReply(
      `🔄 Restart scheduled in ${delaySeconds} second(s).${notifySummary}`,
    );

    setTimeout(() => {
      exec("pm2 restart Eppy", (error, stdout, stderr) => {
        if (error) {
          logger.error(`❌ Błąd restartu: ${error.message}`);
          return;
        }
        if (stderr) {
          logger.error(`❌ Błąd stderr: ${stderr}`);
          return;
        }
        logger.info(`✅ Restart wykonany: ${stdout}`);
      });
    }, delaySeconds * 1000);

    // exec('cmd /c start restart.bat', (error) => {
    //     if (error) {
    //         console.error(`Błąd przy uruchamianiu restart.bat: ${error}`);
    //     }
    //     process.exit();
    // });
  },
};
