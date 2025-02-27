const { SlashCommandBuilder } = require("discord.js");
const { shuffleQueue, getQueue } = require("../../functions/handlers/handleMusic");
const path = require("path");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("shuffle")
        .setDescription("Shuffle queue"),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const queue = getQueue(guildId);

        if (!queue || queue.length < 2) {
            return interaction.reply({
                content: "🚫 Can't shuffle queue because it's now empty!",
                ephemeral: true
            });
        }

        shuffleQueue(guildId);

        if (!queue || queue.length === 0) {
                return interaction.reply({
                   content: "🎵 Queue is epmty!"
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
                content: `🔀 Queue shuffled!\n\n${queueMessage}`,
                });
    }
};
