const { SlashCommandBuilder } = require("discord.js");
const { 
  getQueue, 
  saveQueue,
  isPlay, 
  playersStop,
  playNext
} = require("../../functions/handlers/handleMusic");
const path = require("path");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("skipto")
        .setDescription("Skip to a specific song in the queue.")
        .addIntegerOption(option =>
            option.setName("index")
                .setDescription("The position of the song in the queue to jump to.")
                .setRequired(true)
        ),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        let queue = await getQueue(guildId); // Dodajemy await, aby upewnić się, że kolejka jest pobrana z MongoDB
        const amount = interaction.options.getInteger("index") - 2;
    
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
        await saveQueue(guildId, queue); // Dodajemy await, aby upewnić się, że kolejka jest zapisana w MongoDB
    
        interaction.reply({
            content: `⏭️ Skipped to song number **${amount}**.`
        });
        playersStop(guildId);
        await playNext(guildId, interaction); // Dodajemy await, aby upewnić się, że następna piosenka jest odtwarzana
    }
};
