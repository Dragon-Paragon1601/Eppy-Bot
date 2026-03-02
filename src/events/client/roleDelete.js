const { removeGuildRole } = require("../../functions/handlers/handleRoles");
const logger = require("../../logger");

module.exports = {
  name: "roleDelete",
  async execute(role) {
    if (!role?.guild?.id || !role?.id) {
      return;
    }

    try {
      await removeGuildRole(role.guild.id, role.id);
    } catch (error) {
      logger.error(`Błąd roleDelete sync dla ${role.id}: ${error}`);
    }
  },
};
