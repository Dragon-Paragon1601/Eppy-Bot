const { ActivityType } = require("discord.js");
const logger = require("./../../logger");

module.exports = (client) => {
  if (!client) {
    logger.error("❌ ERROR: Client does not exist!");
    return;
  }

  client.setDefaultPresence = () => {
    if (!client.user) {
      logger.error("⚠️ client.user is null - bot has not logged in yet.");
      return;
    }

    client.user.setPresence({
      activities: [
        {
          name: "Programed",
          type: ActivityType.Playing,
          details: "Creating Eppy Bot",
          state: "By Dragon (1 / 1)",
          timestamps: { start: Date.now() },
          assets: {
            largeImage: "eppy",
            largeText: "Eppy",
            smallImage: "verified",
            smallText: "Verified",
          },
        },
      ],
      status: "online",
    });
  };

  client.once("ready", () => {
    logger.info("✅ pickPresence.js loaded!");
    client.setDefaultPresence();
  });
};
