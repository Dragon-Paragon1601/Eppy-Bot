const { SlashCommandBuilder } = require("discord.js");
const config = require("../../config");
const logger = require("./../../logger");
const { setActivity } = require("../../functions/tools/rpc");
const { addPet, setCooldown, isOnCooldown, getTopPetters } = require("../../functions/handlers/handlePet");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("pet")
        .setDescription("Pet the bot or show the top petters.")
        .addStringOption(option =>
            option.setName("action")
                .setDescription("Choose an action")
                .setRequired(true)
                .addChoices(
                    { name: "pet", value: "pet" },
                    { name: "ranking", value: "ranking" }
                )),
    async execute(interaction) {
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;
        const userName = interaction.user.username;
        const action = interaction.options.getString("action");

        if (action === "ranking") {
            const topPetters = getTopPetters(guildId);
            const topPettersList = topPetters.map((petter, index) => `${index + 1}. <@${petter.userId}>: ${petter.count} pets`).join("\n");

            return interaction.reply({
                content: `🏆 **Top Petters** 🏆\n${topPettersList}`,
            });
        }

        if (action === "pet") {
            const cooldown = isOnCooldown(guildId, userId);
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

            const newStatus = `with ${userName} 🐾`;

            interaction.client.user.setPresence({
                activities: [{ name: newStatus }],
                status: 'online',
            });

            await interaction.reply({
                content: `🐾 ${newStatus}`,
            });

            addPet(guildId, userId);
            if (!config.allowUsers.includes(userId)) {
                setCooldown(guildId, userId);
            }

            setTimeout(() => {
                logger.debug("Resetting activity to default.");
                setActivity();
            }, 15000);
        }
    }
};