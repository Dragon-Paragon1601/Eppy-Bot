const logger = require("./../../logger");
const mongoose = require("mongoose");
const config = require("../../config");

module.exports = {
  name: "ready",
  once: true,
  async execute(client) {
    if (typeof client.pickPresence === "function") {
      client.pickPresence();
      setInterval(() => client.pickPresence(), 30 * 1000);
    } 
    logger.info(`✅ Ready! ${client.user.tag} jest online na ${client.guilds.cache.size} serwerach!`);
    
    if (!config.databaseToken) return;

    await mongoose.connect(config.databaseToken || '' , {
      useNewUrlParser: true,
      useUnifiedTopology: true,
  });
  },
};
