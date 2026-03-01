const logger = require("./../../logger");
const mongoose = require("mongoose");
const config = require("../../config");
const guildAvailableSync = require("./guildAvailable");
const guildMemberSync = require("./guildMemberAdd");
const guildChannelSync = require("./guildTextChannelAviable");
const { CREATOR_WATERMARK } = require("../../Creator");

const ONE_HOUR_MS = 60 * 60 * 1000;
let isGuildSyncRunning = false;

async function syncAllGuildData(client) {
  if (isGuildSyncRunning) {
    return;
  }

  isGuildSyncRunning = true;

  try {
    const guilds = client.guilds.cache;

    for (const guild of guilds.values()) {
      await Promise.allSettled([
        guildAvailableSync.execute(guild),
        guildMemberSync.execute(guild),
        guildChannelSync.execute(guild),
      ]);
    }
  } catch (error) {
    logger.error(`Błąd cyklicznej synchronizacji guildów: ${error}`);
  } finally {
    isGuildSyncRunning = false;
  }
}

module.exports = {
  name: "ready",
  once: true,
  async execute(client) {
    if (typeof client.pickPresence === "function") {
      client.pickPresence();
      setInterval(() => client.pickPresence(), 30 * 1000);
    }

    await syncAllGuildData(client);
    setInterval(() => syncAllGuildData(client), ONE_HOUR_MS);

    logger.info(
      `✅ Ready! ${client.user.tag} jest online na ${client.guilds.cache.size} serwerach!`,
    );
    logger.info(`ℹ️ ${CREATOR_WATERMARK}`);
  },
};
