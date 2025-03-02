const { SlashCommandBuilder } = require("discord.js");
const config = require("../../config");
const logger = require("./../../logger");
const { setBotPresence } = require("../../functions/handlers/handlePresence");
const { addPet, setCooldown, isOnCooldown, getTopPetters } = require("../../functions/handlers/handlePet");
const { client } = require("../../bot");

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
            const topPetters = await getTopPetters(guildId); 
            if (!topPetters || topPetters.length === 0) {
                return interaction.reply({ content: "No pets yet! Be the first to pet Eppy! 🐾", ephemeral: true });
            }
            const topPettersList = topPetters
                .map((petter, index) => `${index + 1}. <@${petter.userId}>: ${petter.count} pets`)
                .join("\n");
            return interaction.reply({
                content: `🏆 **Top Petters** 🏆\n${topPettersList}`,
            });
        }

        if (action === "pet") {
            const cooldownStatus = await isOnCooldown(guildId, userId); 
            if (!config.allowUsers.includes(userId)) {
                if (cooldownStatus.onCooldown) {
                    const minutes = Math.floor(cooldownStatus.remainingTime / 60000);
                    const seconds = Math.floor((cooldownStatus.remainingTime % 60000) / 1000);
                    return interaction.reply({
                        content: `🚫 You have already petted Eppy recently. \nPlease wait ${minutes} minutes and ${seconds} seconds before petting again.`,
                        ephemeral: true,
                    });
                }
            }

            const newStatus = `${userName} petted Eppy🐾`;

            interaction.client.user.setPresence({
                activities: [{ name: newStatus }],
                status: 'online',
            });

            await interaction.reply({
                content: `🐾 ${newStatus}`,
            });

            await addPet(guildId, userId);
            if (!config.allowUsers.includes(userId)) {
                await setCooldown(guildId, userId); 
            }

            setTimeout(() => {
                logger.debug("Resetting activity to default.");
                setBotPresence(client, "online", 0, "Programed", "By Dragon (1 / 1)", "Creating Eppy Bot" );
            }, 60000);
        }
    }
};