const { upsertGuildMember } = require("../../functions/handlers/handleUsers");
const logger = require("../../logger");

module.exports = {
  name: "guildMemberUpdate",
  async execute(_oldMember, newMember) {
    if (!newMember?.guild?.id || !newMember?.id) {
      return;
    }

    try {
      await upsertGuildMember(newMember);
    } catch (error) {
      logger.error(
        `Błąd guildMemberUpdate sync dla ${newMember.guild.id}/${newMember.id}: ${error}`,
      );
    }
  },
};
