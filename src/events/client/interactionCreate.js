const { EmbedBuilder } = require('discord.js');
const logger = require("./../../logger");

module.exports = {
  name: "interactionCreate",
  async execute(interaction, client) {
    if (interaction.isChatInputCommand()) {
      const { commands } = client;
      const { commandName } = interaction;
      const command = commands.get(commandName);
      if (!command) return;

      try {
        await command.execute(interaction, client);
      } catch (error) {
        logger.error(`${error}`);
        await interaction.reply({
          content: `Somthing is not yes...`,
          embeds: [
            new EmbedBuilder()
                .setImage("https://c.tenor.com/MbqJKvm1IXgAAAAC/tenor.gif")
        ],
          ephemeral: true,
        });
      }
    }
  },
};
