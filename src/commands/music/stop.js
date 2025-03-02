const { SlashCommandBuilder } = require("@discordjs/builders");
const { playersStop } = require("../../functions/handlers/handleMusic");
const logger = require("../../logger");
let players = require("../../functions/handlers/handleMusic").players;
let connections = require("../../functions/handlers/handleMusic").connections;
let isPlaying = require("../../functions/handlers/handleMusic").isPlaying;

module.exports = {
    data: new SlashCommandBuilder()
        .setName("stop")
        .setDescription("Disconnect bot from channel and stops playing music"),
    async execute(interaction) {
        try {
            const guildId = interaction.guild.id;
            const voiceChannel = interaction.member.voice.channel;

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
        logger.error(`Error stoping players: ${error}`);
        await interaction.reply({
            content: "❌ Something went wrong while stoping bot.",
            ephemeral: true
        });
    }
    }
};
