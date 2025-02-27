const { 
  SlashCommandBuilder, 
  PermissionsBitField, 
  ChannelType, 
  MessageFlags 
} = require("discord.js");
const { 
  saveConfig, 
  loadConfig 
} = require("../../functions/handlers/handleMusic");
const logger = require("../../logger");
const fs = require("fs");
const path = require("path");

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
            return interaction.reply({ content: "❌ You need 'Manage Channels' permission to use this command!", flags: MessageFlags.Ephemeral });
        }

        const config = loadConfig();
        const guildId = interaction.guild.id;
        const noneOption = interaction.options.getString("none");
        const channel = interaction.options.getChannel("channel");

        if (noneOption === "none") {
            if (config[guildId]) {
                delete config[guildId];
                saveConfig(config);
                return interaction.reply({ content: "✅ Queue messages will now be sent in the default channel!", flags: MessageFlags.Ephemeral });
            } else {
                return interaction.reply({ content: "⚠️ No queue channel was set for this server.", flags: MessageFlags.Ephemeral });
            }
        }

        if (channel) {
            config[guildId] = channel.id;
            saveConfig(config);
            return interaction.reply({ content: `✅ Queue messages will now be sent in \n<#${channel.id}>!`, flags: MessageFlags.Ephemeral });
        }

        return interaction.reply({ content: "❌ You must either select a channel or type 'none' to remove the queue channel.", flags: MessageFlags.Ephemeral });
    }
};
