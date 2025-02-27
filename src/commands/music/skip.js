const { SlashCommandBuilder } = require("discord.js");
const { 
  getQueue, 
  saveQueue,
  isPlay,
  playersStop,
} = require("../../functions/handlers/handleMusic");
const path = require("path");


module.exports = {
    data: new SlashCommandBuilder()
        .setName("skip")
        .setDescription("Skip to another song in queue"),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        let queue = getQueue(guildId);

        if (!queue || queue.length === 0) {
            return interaction.reply({
                content: "🚫 Queue is epmty!",
                ephemeral: true
            });
        }

        isPlay(guildId);
        const skippedSong = queue.shift();
        saveQueue(guildId, queue);
        
        if (queue.length === 0) {
            return interaction.reply({
                content: `⏭️ Skipped **${skippedSong}**, but queue is now empty!`,
            });
        }
        const skippedSongName = path.basename(skippedSong, ".mp3").replace(/_/g, " ");
        const currentSongName = path.basename(queue[0], ".mp3").replace(/_/g, " ");
        interaction.reply({
            content: `⏭️ Skipped: \n**${skippedSongName}** \nNow playing: \n**${currentSongName}**`
        });
        playersStop(guildId);
    }
};
