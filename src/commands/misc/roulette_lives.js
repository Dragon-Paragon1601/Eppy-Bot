const { SlashCommandBuilder } = require("discord.js");
const { getUserData } = require("../../functions/handlers/handleRoulette");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("roulette_lives")
        .setDescription("Check your lives and currency."),
    async execute(interaction) {
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;

        const userData = getUserData(guildId, userId);

        await interaction.reply({
            content: `Your \nLives: **${userData.lives}** ❤️ \nCoins: **${userData.currency}** 🪙.`,
            ephemeral: true,
        });
    }
};