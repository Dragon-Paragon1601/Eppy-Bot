const Guild = require("../../schemas/guild");
const { SlashCommandBuilder } = require("discord.js");
const mongoose = require("mongoose");
const logger = require("./../../logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("database")
    .setDescription("Return information from database"),
  async execute(interaction, client) {
    let guildProfile = await Guild.findOne({ guildId: interaction.guild.id });
    if (!guildProfile) {
      guildProfile = await new Guild({
        _id: new mongoose.Types.ObjectId(),
        guildId: interaction.guild.id,
        guildName: interaction.guild.name,
        guildIcon: interaction.guild.iconURL()
          ? interaction.guild.iconURL()
          : "None",
      });

      await guildProfile.save().catch(err => logger.error(`Błąd zapisu guildProfile: ${err}`));
      await interaction.reply({
        content: `Server Name: ${guildProfile.guildName}`,
      });
      logger.debug(`guildProfile: ${guildProfile}`);
    } else {
      await interaction.reply({
        content: `Server ID: ${guildProfile.guildId}`,
      });
      logger.debug(`guildProfile: ${guildProfile}`);
    }
  },
};
