const { 
  SlashCommandBuilder, 
  PermissionsBitField, 
  ChannelType, 
  MessageFlags 
} = require("discord.js");
const QueueChannel = require("../../schemas/queueChannel");
const logger = require("../../logger");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("queue_channel")
        .setDescription("Set or remove the channel for queue messages.")
        .addChannelOption(option =>
            option.setName("channel")
                .setDescription("Select a text channel (or use 'none' to remove)")
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName("none")
                .setDescription("Delete queue channel!")
                .addChoices(
                    { name: "None (delete channel)", value: "none" }
                )
                .setRequired(false)
        ),

    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            return interaction.reply({ content: "❌ You need 'Manage Channels' permission to use this command!", ephemeral: true });
        }

        const guildId = interaction.guild.id;
        const noneOption = interaction.options.getString("none");
        const channel = interaction.options.getChannel("channel");

        if (noneOption === "none") {
            const queueChannel = await QueueChannel.findOneAndDelete({ guildId });
            if (queueChannel) {
                return interaction.reply({ content: "✅ Queue messages will now be sent in the default channel!", ephemeral: true });
            } else {
                return interaction.reply({ content: "⚠️ No queue channel was set for this server.", ephemeral: true });
            }
        }

        if (channel) {
            await QueueChannel.findOneAndUpdate(
                { guildId },
                { channelId: channel.id },
                { upsert: true, new: true }
            );
            return interaction.reply({ content: `✅ Queue messages will now be sent in <#${channel.id}>!`, ephemeral: true });
        }

        return interaction.reply({ content: "❌ You must either select a channel or type 'none' to remove the queue channel.", ephemeral: true });
    }
};
