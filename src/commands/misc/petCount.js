const { SlashCommandBuilder } = require("discord.js");
const { getTopPetters } = require("../../functions/handlers/handlePet");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("petcount")
        .setDescription("Show the top petters of the bot."),
    async execute(interaction) {
        const guildId = interaction.guild.id;
        const topPetters = getTopPetters(guildId);
        const topPettersList = topPetters.map((petter, index) => `${index + 1}. <@${petter.userId}>: ${petter.count} pets`).join("\n");

        await interaction.reply({
            content: `🏆 **Top Petters** 🏆\n${topPettersList}`,
        });
    }
};