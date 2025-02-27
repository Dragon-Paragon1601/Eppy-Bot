const { updateLives, addCurrency, hasLives, getUserData, getTopUsers } = require("../../functions/handlers/handleRoulette");
const { SlashCommandBuilder } = require("discord.js");
const config = require("../../config");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("roulette")
        .setDescription("Play a game of russian roulette (5-1).")
        .addStringOption(option =>
            option.setName("action")
                .setDescription("Choose an action")
                .setRequired(true)
                .addChoices(
                    { name: "shoot", value: "shoot" },
                    { name: "roll", value: "roll" },
                    { name: "quit", value: "quit" },
                    { name: "lives", value: "lives" },
                    { name: "rank", value: "rank" }
                )),
    async execute(interaction) {
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;
        const action = interaction.options.getString("action");

        if (action === "lives") {
            const { lives, currency } = getUserData(guildId, userId);
            return interaction.reply({
                content: `Your \nLives: **${lives}** ❤️ \nCoins: **${currency}** 🪙.`,
                ephemeral: true,
            });
        }

        if (action === "rank") {
            const topUsers = getTopUsers(guildId);
            const rankList = topUsers.map((user, index) => `${index + 1}. <@${user.userId}> **${user.lives}** ❤️ with **${user.currency}** 🪙`).join("\n");
            return interaction.reply({
                content: `🏆 **Top Users** 🏆\n${rankList}`,
            });
        }

        if (!config.allowUsers.includes(userId)) {
            if (!hasLives(guildId, userId)) {
                return interaction.reply({
                    content: "🚫 You have no lives left. Please wait until tomorrow to play again.",
                    ephemeral: true,
                });
            }
        }

        const outcomes = ["💥 You lost!", "🎉 You won!", "🎉 You won!", "🎉 You won!", "🎉 You won!", "🎉 You won!"];
        let result;

        if (action === "quit") {
            const nextOutcome = outcomes[Math.floor(Math.random() * outcomes.length)];
            return interaction.reply({
                content: `Game reset. \nThe next action would have been: ${nextOutcome}`,
                ephemeral: true,
            });
        }

        if (action === "shoot") {
            result = outcomes[Math.floor(Math.random() * outcomes.length)];
            if (result === "💥 You lost!") {
                updateLives(guildId, userId, -1);
            } else {
                addCurrency(guildId, userId, 1);
            }
        } else if (action === "roll") {
            result = "🔄 You rolled the cylinder. The game continues.";
        }

        await interaction.reply({
            content: result,
            ephemeral: true,    
        });
    }
};