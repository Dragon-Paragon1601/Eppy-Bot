const { SlashCommandBuilder } = require("@discordjs/builders");
const { stopMusic } = require("../../functions/handlers/handleMusic");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("stop")
        .setDescription("Disconnect bot from channel and stops playing music"),
    async execute(interaction) {
        const guildId = interaction.guild.id;
        const voiceChannel = interaction.member.voice.channel;

        if (!voiceChannel) {
            return interaction.reply({ content: "❌ You have to be on a voice channel", ephemeral: true });
        }

        stopMusic(guildId);
        interaction.reply({ content: "⏹️ Music stopped and disconnected form channel", ephemeral: false });
    },
};
