const logger = require("./../../logger");
const mongoose = require("mongoose");
const config = require("../../config");
const { CREATOR_WATERMARK } = require("../../Creator");
const { restoreTempBans } = require("../../database/tempBanStore");
const { syncAllGuildData } = require("../../functions/tools/fullGuildSync");

const FULL_SYNC_INTERVAL_MS = 30 * 60 * 1000;

module.exports = {
  name: "ready",
  once: true,
  async execute(client) {
    await restoreTempBans(client);

    if (typeof client.pickPresence === "function") {
      client.pickPresence();
      setInterval(() => client.pickPresence(), 30 * 1000);
    }

    await syncAllGuildData(client);
    setInterval(() => syncAllGuildData(client), FULL_SYNC_INTERVAL_MS);

    logger.info(
      `✅ Ready! ${client.user.tag} jest online na ${client.guilds.cache.size} serwerach!`,
    );
    logger.info(`ℹ️ ${CREATOR_WATERMARK}`);
  },
};
