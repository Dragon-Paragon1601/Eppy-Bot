const { SlashCommandBuilder } = require("discord.js");
const { getQueue, saveQueue } = require("../../functions/handlers/handleMusic");
const path = require("path");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("unplay")
        .setDescription("Delete song from queue")
        .addIntegerOption(option => 
            option.setName("index")
                .setDescription("Song number (starting from 1)")
                .setRequired(true)
        ),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const index = interaction.options.getInteger("index") - 1;
        const queue = await getQueue(guildId); // Dodajemy await, aby upewnić się, że kolejka jest pobrana z MongoDB

        if (!queue || queue.length === 0) {
            return interaction.reply({
                content: "🚫 Queue is empty!",
                ephemeral: true
            });
        }

        if (index < 0 || index >= queue.length) {
            return interaction.reply({
                content: "🚫 Wrong song number!",
                ephemeral: true
            });
        }

        if (index === 0) {
            return interaction.reply({
                content: "🚫 You can't delete currently played song!",
                ephemeral: true
            });
        }

        const removedSongPath = queue.splice(index, 1)[0];
        await saveQueue(guildId, queue); // Dodajemy await, aby upewnić się, że kolejka jest zapisana w MongoDB

        const removedSongName = path.basename(removedSongPath)
            .replace(/\.mp3$/, "")
            .replace(/_/g, " ");

        interaction.reply({
            content: `🗑️ Deleted **${removedSongName}** from queue`
        });
    }
};
