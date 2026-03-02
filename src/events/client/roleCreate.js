const { upsertGuildRole } = require("../../functions/handlers/handleRoles");
const logger = require("../../logger");

module.exports = {
  name: "roleCreate",
  async execute(role) {
    if (!role?.guild?.id || !role?.id) {
      return;
    }

    try {
      await upsertGuildRole(role);
    } catch (error) {
      logger.error(`Błąd roleCreate sync dla ${role.id}: ${error}`);
    }
  },
};
