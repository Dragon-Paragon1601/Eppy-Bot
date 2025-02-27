const logger = require("./../../logger");

module.exports = {
  name: "ready",
  once: true,
  async execute(client) {
    if (typeof client.pickPresence === "function") {
      client.pickPresence();
      setInterval(() => client.pickPresence(), 30 * 1000);
    } 
    logger.info(`✅ Ready! ${client.user.tag} jest online na ${client.guilds.cache.size} serwerach!`);
  },
};
