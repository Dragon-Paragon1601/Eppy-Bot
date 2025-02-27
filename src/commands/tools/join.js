const { SlashCommandBuilder } = require("discord.js");
const { joinVoiceChannel, getVoiceConnection } = require("@discordjs/voice");
const logger = require("./../../logger");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("join")
        .setDescription("Dołącza do kanału głosowego, na którym jesteś."),

    async execute(interaction) {
        const voiceChannel = interaction.member.voice.channel;

        if (!voiceChannel) {
            return interaction.reply({
                content: "🚫 Musisz być na kanale głosowym, aby użyć tej komendy!",
                ephemeral: true
            });
        }

        const existingConnection = getVoiceConnection(interaction.guild.id);
        if (existingConnection) {
            return interaction.reply({
                content: `✅ Bot już jest na kanale **${existingConnection.joinConfig.channelId}**.`,
                ephemeral: true
            });
        }

        try {
            joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: interaction.guild.id,
                adapterCreator: interaction.guild.voiceAdapterCreator,
            });

            interaction.reply(`✅ Dołączono do kanału **${voiceChannel.name}**!`);
        } catch (error) {
            logger.error(`❌ Błąd podczas dołączania do kanału głosowego: ${error}`);
            interaction.reply({
                content: "🚫 Wystąpił błąd podczas próby dołączenia do kanału.",
                ephemeral: true
            });
        }
    },
};
