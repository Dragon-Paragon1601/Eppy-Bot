const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const logger = require("./../../logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("refresh")
    .setDescription("Refresh all commands"),

  async execute(interaction) {
    try {
      await interaction.client.application.commands.set([]);
      await interaction.guild.commands.set([]);
      await interaction.client.refreshCommandsAfterUse(interaction);
    } catch (error) {
      logger.error(`Błąd przy odświeżaniu komend: ${error}`);
      await interaction.reply({
        content: "❌ Error accured during commands refreshing!",
        flags: MessageFlags.Ephemeral
      });
    }
  },
};
