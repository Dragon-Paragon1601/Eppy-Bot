const { upsertGuildRole } = require("../../functions/handlers/handleRoles");
const logger = require("../../logger");

module.exports = {
  name: "roleUpdate",
  async execute(_oldRole, newRole) {
    if (!newRole?.guild?.id || !newRole?.id) {
      return;
    }

    try {
      await upsertGuildRole(newRole);
    } catch (error) {
      logger.error(`Błąd roleUpdate sync dla ${newRole.id}: ${error}`);
    }
  },
};
