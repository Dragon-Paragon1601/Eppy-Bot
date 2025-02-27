const { 
  SlashCommandBuilder,
  PermissionFlagsBits,
  PermissionsBitField 
  } = require("discord.js");
const logger = require("./../../logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kicks the member provided.")
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((option) =>
      option
        .setName("target")
        .setDescription("The member you'd like to kick")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("The reason for kicking the member provided")
    ),
  async execute(interaction) {
    const user = interaction.options.getUser("target");
    let reason = interaction.options.getString("reason");
    const member = await interaction.guild.members
      .fetch(user.id)
      .catch(err => logger.error(`interaction guild member: ${err}`));

    if (!reason) reason = "No reason provided.";
    if (
      !interaction.member.permissions.has(PermissionsBitField.Flags.KickMembers)
    )
      return await interaction.reply({
        content:
          "You must have the kick members permission to use this command",
        ephemeral: true,
      });

    await user
      .send({
        content: `=========================\nYou have been kicked from: ${interaction.guild.name}\nBy: ${interaction.member}\nFor reason: ${reason}\n=========================`,
      })
      .catch(logger.info("user's Dm's are off"));

    await member.kick(reason).catch(err => logger.error(`Błąd member.kick: ${err}`));

    await interaction.reply({
      content: `=========================\n${user.tag} got kicked\nBy: ${interaction.member}\nFor reason: ${reason}\n=========================`,
    });
  },
};
