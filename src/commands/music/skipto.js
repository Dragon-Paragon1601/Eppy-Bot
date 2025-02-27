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
        .setName("skipto")
        .setDescription("Skip to a specific song in the queue.")
        .addIntegerOption(option =>
            option.setName("index")
                .setDescription("The position of the song in the queue to jump to.")
                .setRequired(true)
        ),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        let queue = getQueue(guildId);
        const amount = interaction.options.getInteger("index");
    
        if (!queue || queue.length === 0) {
            return interaction.reply({
                content: "🚫 Queue is empty!",
                ephemeral: true
            });
        }
    
        if (amount <= 0 || amount >= queue.length) {
            return interaction.reply({
                content: "🚫 Wrogn song number!",
                ephemeral: true
            });
        }
    
        isPlay(guildId);
        queue.splice(0, amount);
        saveQueue(guildId, queue);
    
        interaction.reply({
            content: `⏭️ Skiped **${amount}**.`
        });
        playersStop(guildId)
        }
    };
