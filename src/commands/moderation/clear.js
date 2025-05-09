const { 
    SlashCommandBuilder,
    PermissionFlagsBits, 
    MessageFlags,
} = require('discord.js');
const logger = require("./../../logger");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("clear")
        .setDescription("Deletes messages from the channel.")
        .addIntegerOption(option =>
            option.setName("amount")
                .setDescription("Number of messages to delete (default: all)")
                .setMinValue(1)
                .setMaxValue(100)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        const { channel, member } = interaction;
        const amount = interaction.options.getInteger("amount");

        if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.reply({
                content: "❌ You do not have permission to manage messages!",
                flags: MessageFlags.Ephemeral
            });
        }

        try {
            await interaction.deferReply();
            const infoMessage = await interaction.followUp({
                content: amount 
                    ? `🧹 Deleting ${amount} messages...`
                    : `🧹 Deleting all messages...`,
                ephemeral: true
            });

            if (amount) {
                const messages = await channel.messages.fetch({ limit: amount });
                await channel.bulkDelete(messages, true);
                return infoMessage.edit({
                    content: `✅ Deleted ${messages.size} messages!`,
                });
            } else {
                let deleted = 0;
                let fetched;

                do {
                    fetched = await channel.messages.fetch({ limit: 100 });
                    await channel.bulkDelete(fetched, true);
                    deleted += fetched.size;
                } while (fetched.size >= 2);

                return infoMessage.edit({
                    content: `✅ Deleted **${deleted}** messages!`,
                });
            }
        } catch (error) {
            logger.error(`Error deleting messages: ${error.message}`);
            let errorMessage = "❌ Failed to delete messages.";

            if (error.message.includes("14 days")) {
                errorMessage += " Make sure messages are not older than 14 days.";
            } else if (error.message.includes("permissions")) {
                errorMessage += " Check bot permissions.";
            }

            return interaction.followUp({
                content: errorMessage,
                ephemeral: true
            });
        }
    }
};