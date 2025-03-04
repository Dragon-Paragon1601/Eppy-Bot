const { SlashCommandBuilder } = require("discord.js");
const { getQueue } = require("../../functions/handlers/handleMusic");
const path = require("path");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("queue")
        .setDescription("Displays the current queue of songs"),
        
    async execute(interaction) {
        const guildId = interaction.guild.id;
        const queue = await getQueue(guildId);

        if (!queue || queue.length === 0) {
            return interaction.reply({
                content: "🎵 Queue is now epmty."
            });
        }

        const displayedQueue = queue.slice(0, 25)
            .map((file, index) => {
                const songName = path.basename(file)
                    .replace(/\.mp3$/, "")
                    .replace(/_/g, " ");
                return `\`${index + 1}.\` **${songName}**`;
            })
            .join("\n");

        const queueMessage = queue.length > 25 
            ? `📁 **Current queue:**\n${displayedQueue}\n...and **${queue.length - 25}** more songs!`
            : `📁 **Current queue:**\n${displayedQueue}`;

        return interaction.reply({
            content: queueMessage
        });
    }
};
