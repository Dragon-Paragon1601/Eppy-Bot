const { SlashCommandBuilder } = require("discord.js");
const config = require("../../config");
const { updateLives, addCurrency, hasLives, resetLives } = require("../../functions/handlers/handleRoulette");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("roulette")
        .setDescription("Play a game of russian roulette (5-1)."),
    async execute(interaction) {
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;
        const userName = interaction.user.username;

        resetLives();

        if (!config.allowedUsers.includes(userId)) {
            if (!hasLives(guildId, userId)) {
                return interaction.reply({
                    content: "🚫 You have no lives left. Please wait until tomorrow to play again.",
                    ephemeral: true,
                });
            }
        }

        const outcomes = ["💥 You lost!", "🎉 You won!", "🎉 You won!", "🎉 You won!", "🎉 You won!", "🎉 You won!"];
        const result = outcomes[Math.floor(Math.random() * outcomes.length)];

        if (result === "💥 You lost!") {
            updateLives(guildId, userId, -1);
        } else {
            addCurrency(guildId, userId, 1);
        }

        await interaction.reply({
            content: result,
        });
    }
};