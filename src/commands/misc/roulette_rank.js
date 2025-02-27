const { SlashCommandBuilder } = require("discord.js");
const { getTopUsers } = require("../../functions/handlers/handleRoulette");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("roulette_rank")
        .setDescription("Show the top users by currency."),
    async execute(interaction) {
        const guildId = interaction.guild.id;

        const topUsers = getTopUsers(guildId);
        const rankList = topUsers.map((user, index) => `${index + 1}. <@${user.userId}> **${user.lives}**  ❤️  with  **${user.currency}** 🪙`).join("\n");

        await interaction.reply({
            content: `🏆 **Top Users** 🏆\n${rankList}`,
        });
    }
};