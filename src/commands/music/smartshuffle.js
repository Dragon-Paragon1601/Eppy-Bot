const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const config = require("../../config");
const logger = require("../../logger");
const runtimeStore = require("../../database/runtimeStore");
const {
  setAutoMode,
  setRandomMode,
  setLoopQueueMode,
  clearLoopSource,
} = require("../../functions/handlers/handleMusic");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("smartshuffle")
    .setDescription("Manage smart shuffle state and statistics")
    .addStringOption((option) =>
      option
        .setName("action")
        .setDescription("Action to perform")
        .setRequired(true)
        .addChoices({ name: "clear", value: "clear" }),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const action = interaction.options.getString("action");
    const guildId = interaction.guild.id;
    const memberId = interaction.user.id;

    const isAdmin = interaction.member.permissions.has(
      PermissionFlagsBits.Administrator,
    );
    const allowedUsers = (config.allowUsers || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (!isAdmin && !allowedUsers.includes(memberId)) {
      return interaction.reply({
        content:
          "❌ You need to be an administrator or in allowlist to use this command.",
        ephemeral: true,
      });
    }

    if (action === "clear") {
      try {
        const result = await runtimeStore.clearMusicStats(guildId);

        setAutoMode(guildId, false);
        setRandomMode(guildId, false);
        setLoopQueueMode(guildId, false);
        clearLoopSource(guildId);

        return interaction.reply({
          content: `🧹 Smart shuffle został zresetowany. Usunięto **${result.deletedCount || 0}** rekordów statystyk dla tej gildii.`,
          ephemeral: true,
        });
      } catch (err) {
        logger.error(`Error in /smartshuffle clear: ${err}`);
        return interaction.reply({
          content: `❌ Error: ${err.message}`,
          ephemeral: true,
        });
      }
    }

    return interaction.reply({
      content: "❌ Unknown action.",
      ephemeral: true,
    });
  },
};
