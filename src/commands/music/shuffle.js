const { SlashCommandBuilder } = require("discord.js");
const { shuffleQueue, getQueue } = require("../../functions/handlers/handleMusic");
const path = require("path");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("shuffle")
        .setDescription("Shuffle queue"),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const queue = await getQueue(guildId); // Dodajemy await, aby upewnić się, że kolejka jest pobrana z MongoDB

        if (!queue || queue.length < 2) {
            return interaction.reply({
                content: "🚫 Can't shuffle queue because it's now empty!",
                ephemeral: true
            });
        }

        await shuffleQueue(guildId); // Dodajemy await, aby upewnić się, że kolejka jest przetasowana przed kontynuacją

        const queueNew = await getQueue(guildId); // Dodajemy await, aby upewnić się, że nowa kolejka jest pobrana z MongoDB
        const displayedQueue = queueNew.slice(0, 25)
            .map((file, index) => {
                const songName = path.basename(file)
                    .replace(/\.mp3$/, "")
                    .replace(/_/g, " ");
                return `\`${index + 1}.\` **${songName}**`;
            })
            .join("\n");

        const queueMessage = queueNew.length > 25 
            ? `📁 **Current queue:**\n${displayedQueue}\n...and **${queueNew.length - 25}** more songs!`
            : `📁 **Current queue:**\n${displayedQueue}`;

        return interaction.reply({
            content: `🔀 Queue shuffled!\n\n${queueMessage}`,
        });
    }
};
