const { SlashCommandBuilder } = require("discord.js");
const { clearQueue, isPlay, playersStop, connections } = require("../../functions/handlers/handleMusic");
const { clearAudioFolders } = require("../../functions/handlers/handleClearAudio");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("clear_queue")
        .setDescription("Clear queue."),
    async execute(interaction) {
        try {
            const guildId = interaction.guild.id;

            clearQueue(guildId);
            if (connections[guildId]) {
                playersStop(guildId);
                isPlay(guildId);
                players[guildId].stop();
                connections[guildId]?.destroy();
                delete connections[guildId];
            }

            await interaction.reply({
                content: "🗑️ Queue cleared!"
            });

            clearAudioFolders(guildId);

            await interaction.followUp({
                content: "🗑️ All audio files cleared!"
            });
        } catch (error) {
            logger.error(`Error clearing queue: ${error}`);
            await interaction.reply({
                content: "❌ Somthing went wrong while deleting queue and audio files.",
                ephemeral: true
            });
        }
    }
};