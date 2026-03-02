const { SlashCommandBuilder } = require("discord.js");
const config = require("../../config");
const logger = require("../../logger");
const { syncAllGuildData } = require("../../functions/tools/fullGuildSync");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("database_refreash")
    .setDescription(
      "Force full database refresh/sync without bot restart (allowUsers only)",
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

    await interaction.deferReply({ ephemeral: true });

    try {
      const syncResult = await syncAllGuildData(interaction.client, {
        log: true,
      });

      if (syncResult.skipped && syncResult.reason === "already-running") {
        return interaction.editReply(
          "⏳ Full database sync is already running. Try again in a moment.",
        );
      }

      if (syncResult.reason === "error") {
        return interaction.editReply(
          "❌ Database refresh failed. Check bot logs for details.",
        );
      }

      return interaction.editReply(
        [
          "✅ Database refresh finished.",
          `• Guilds total: ${syncResult.guildCount}`,
          `• Guilds synced: ${syncResult.processedGuilds}`,
          `• Guilds with errors: ${syncResult.failedGuilds}`,
          `• Duration: ${syncResult.durationMs || 0} ms`,
        ].join("\n"),
      );
    } catch (error) {
      logger.error(`database_refreash command error: ${error}`);
      return interaction.editReply(
        `❌ Error while refreshing database: ${error.message}`,
      );
    }
  },
};
