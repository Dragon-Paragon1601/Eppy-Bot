const { SlashCommandBuilder } = require("discord.js");
const { getQueue, playNext } = require("../../functions/handlers/handleMusic");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("resume")
        .setDescription("Resume playing songs from queue!"),

    async execute(interaction) {
        await interaction.deferReply();

        const guildId = interaction.guild.id;
        const queue = getQueue(guildId);

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
};

