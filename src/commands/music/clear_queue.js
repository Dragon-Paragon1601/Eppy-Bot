const { SlashCommandBuilder } = require("discord.js");
const { clearQueue, playersStop } = require("../../functions/handlers/handleMusic");
const { clearAudioFolders } = require("../../functions/handlers/handleClearAudio");
const logger = require("../../logger");
let players = require("../../functions/handlers/handleMusic").players;
let connections = require("../../functions/handlers/handleMusic").connections;
let isPlaying = require("../../functions/handlers/handleMusic").isPlaying;

module.exports = {
    data: new SlashCommandBuilder()
        .setName("clear_queue")
        .setDescription("Clear queue."),
    async execute(interaction) {
        try {
            const guildId = interaction.guild.id;

            await clearQueue(guildId); // Dodajemy await, aby upewnić się, że kolejka jest wyczyszczona przed kontynuacją
            if (connections[guildId]) {
                playersStop(guildId);
                isPlaying[guildId] = false;
                players[guildId].stop();
                connections[guildId]?.destroy();
                delete connections[guildId];
            }

            await interaction.reply({
                content: "🗑️ Queue cleared!"
            });

            await clearAudioFolders(guildId); // Dodajemy await, aby upewnić się, że pliki audio są wyczyszczone przed kontynuacją

            await interaction.followUp({
                content: "🗑️ All audio files cleared!"
            });
        } catch (error) {
            logger.error(`Error clearing queue: ${error}`);
            await interaction.reply({
                content: "❌ Something went wrong while deleting queue and audio files.",
                ephemeral: true
            });
        }
    }
};