const { SlashCommandBuilder } = require("discord.js");
const config = require("../../config");
const logger = require("./../../logger");
const { setActivity } = require("../../functions/tools/rpc");
const { addPet, setCooldown, isOnCooldown } = require("../../functions/handlers/handlePet");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("pet")
        .setDescription("Pet the bot!"),
    async execute(interaction) {
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;
        const userName = interaction.user.username;

        const cooldown = isOnCooldown(userId);
        if (!config.allowUsers.includes(userId)) {
            if (cooldown) {
                const minutes = Math.floor(cooldown / 60000);
                const seconds = Math.floor((cooldown % 60000) / 1000);
                return interaction.reply({
                    content: `🚫 You have already petted Eppy recently. \nPlease wait ${minutes} minutes and ${seconds} seconds before petting again.`,
                    ephemeral: true,
                });
            }
        }

        const newStatus = `${userName} petted Eppy 🐾`;

        interaction.client.user.setPresence({
            activities: [{ name: newStatus }],
            status: 'online',
        });

        await interaction.reply({
            content: `🐾 ${newStatus}`,
        });

        addPet(guildId, userId);
        if (!config.allowUsers.includes(userId)) {
            setCooldown(userId);
        }

        setTimeout(() => {
            setActivity();
        }, 15000);
    }
};