const { SlashCommandBuilder } = require("discord.js");
const { getQueue, playNext, shuffleQueue, saveQueue, isPlay, playersStop, clearQueue } = require("../../functions/handlers/handleMusic");
const { clearAudioFolders } = require("../../functions/handlers/handleClearAudio");
const path = require("path");
const logger = require("./../../logger");
let players = require("../../functions/handlers/handleMusic").players;
let connections = require("../../functions/handlers/handleMusic").connections;
let isPlaying = require("../../functions/handlers/handleMusic").isPlaying;

module.exports = {
    data: new SlashCommandBuilder()
        .setName("queue")
        .setDescription("Commands related to queue.")
        .addStringOption(option => 
            option.setName("action")
                .setDescription("Choose action to perform on the queue")
                .setRequired(true)
                .addChoices(
                    { name: "queue", value: "queue" },
                    { name: "clear", value: "clear" },
                    { name: "resume", value: "resume" },
                    { name: "shuffle", value: "shuffle" },
                    { name: "skip", value: "skip" },
                    { name: "skipto", value: "skipto" },
                    { name: "stop", value: "stop" },
                    { name: "unplay", value: "unplay" }
                )
        ).addStringOption(option =>
            option.setName("index").setDescription("Song number for 'skipto' or 'unplay' action")
            .setRequired(false)
        ),

    async execute(interaction) {
        const action = interaction.options.getString("action");
        const guildId = interaction.guild.id;
        const queue = await getQueue(guildId);
        const amount = interaction.options.getInteger("index") - 2;
        const voiceChannel = interaction.member.voice.channel;

        if (action === "queue") {
            if (!queue || queue.length === 0) {
                return interaction.reply({
                    content: "🎵 Queue is now empty."
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

        if (action === "clear") {
            try {
                await clearQueue(guildId); 
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

                await clearAudioFolders(guildId); 

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

        if (action === "shuffle") {
            if (!queue || queue.length < 2) {
                return interaction.reply({
                    content: "🚫 Can't shuffle queue because it's now empty!",
                    ephemeral: true
                });
            }

            await shuffleQueue(guildId); 

            const queueNew = await getQueue(guildId);
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

        if (action === "skip") {
            if (!queue || queue.length === 0) {
                return interaction.reply({
                    content: "🚫 Queue is empty!",
                    ephemeral: true
                });
            }

            isPlay(guildId);

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
            await playNext(guildId, interaction);
        }
        
        if (action === "skipto") {
            if (!queue || queue.length === 0) {
                return interaction.reply({
                    content: "🚫 Queue is empty!",
                    ephemeral: true
                });
            }
        
            if (amount <= 0 || amount >= queue.length) {
                return interaction.reply({
                    content: "🚫 Wrong song number!",
                    ephemeral: true
                });
            }
        
            isPlay(guildId);
            queue.splice(0, amount);
            await saveQueue(guildId, queue); 
        
            interaction.reply({
                content: `⏭️ Skipped to song number **${amount}**.`
            });
            playersStop(guildId);
            await playNext(guildId, interaction);
        }

        if (action === "stop") {
            try {
                if (!voiceChannel) {
                    return interaction.reply({ content: "❌ You have to be on a voice channel", ephemeral: true });
                }

                if (connections[guildId]) {
                    playersStop(guildId);
                    isPlaying[guildId] = false;
                    players[guildId].stop();
                    connections[guildId].destroy();
                    delete connections[guildId];
                }

                interaction.reply({ 
                    content: "⏹️ Music stopped and disconnected from channel", 
                    ephemeral: false 
                });
            } catch (error) {
                logger.error(`Error stopping players: ${error}`);
                await interaction.reply({
                    content: "❌ Something went wrong while stopping bot.",
                    ephemeral: true
                });
            }
        }

        if (action === "unplay") {
            const guildId = interaction.guild.id;
            const index = interaction.options.getInteger("index") - 2;
            const queue = await getQueue(guildId);

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
            await saveQueue(guildId, queue); 

            const removedSongName = path.basename(removedSongPath)
                .replace(/\.mp3$/, "")
                .replace(/_/g, " ");

            interaction.reply({
                content: `🗑️ Deleted **${removedSongName}** from queue`
            });
        }

        if (action === "resume") {
            await interaction.deferReply();

            if (!queue || queue.length === 0) {
                return interaction.editReply({
                    content: "🚫 Queue is empty. Use `/play` to add more songs!", 
                    ephemeral: true
                });
            }

            interaction.editReply({
                content: "▶️ Resuming playback..."
            });

            await playNext(guildId, interaction);
        }
    }
};
