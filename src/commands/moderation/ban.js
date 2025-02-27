const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  PermissionsBitField,
} = require("discord.js");
const logger = require("./../../logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban the member provided.")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((option) =>
      option
        .setName("target")
        .setDescription("The member you'd like to ban")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("time")
        .setDescription("Number of days of member messages to delete (1 to 7)")
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("The reason for banning the member provided")
    ),

  async execute(interaction) {
    const user = interaction.options.getUser("target");
    let reason = interaction.options.getString("reason");
    let time = interaction.options.getInteger("time");
    const member = await interaction.guild.members
      .fetch(user.id)
      .catch(err => logger.error(`interaction guild member:  ${err}`));
    if (!reason) reason = "No reason provided.";
    if (!time) time = 0;
    if (
      !interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers)
    )
      return await interaction.reply({
        content:
          "You must have the ban members permission or higher role to use this command",
        ephemeral: true,
      });
    await user
      .send({
        content: `=========================\nYou have been baned from: ${interaction.guild.name}\n By: ${interaction.member}\nFor reason: ${reason}\n=========================`,
      })
      .catch(logger.info("user's Dm's are off"));

    await member
      .ban({
        deleteMessageDays: 0 <= time <= 7,
        reason: reason,
      })
      .catch(err => logger.error(`Usuwanie wiadomości bat: ${err}`), () => {
        return interaction.reply({ content: "I cannot ban this member!" });
      });

    await interaction.reply({
      content: `=========================\n${user.tag} got banned\nBy: ${interaction.member}\nFor reason: ${reason}\n=========================`,
    });
  },
};
