const { removeGuildMember } = require("../../functions/handlers/handleUsers");
const logger = require("../../logger");

module.exports = {
  name: "guildMemberRemove",
  async execute(member) {
    if (!member?.guild?.id || !member?.id) {
      return;
    }

    try {
      await removeGuildMember(member.guild.id, member.id);
    } catch (error) {
      logger.error(
        `Błąd guildMemberRemove sync dla ${member.guild.id}/${member.id}: ${error}`,
      );
    }
  },
};
