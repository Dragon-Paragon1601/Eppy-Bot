const logger = require("../../logger");
const guildAvailableSync = require("../../events/client/guildAvailable");
const guildMemberSync = require("../../events/client/guildMemberAdd");
const guildChannelSync = require("../../events/client/guildTextChannelAviable");
const { saveAllGuildRoles } = require("../handlers/handleRoles");

let isGuildSyncRunning = false;

async function syncAllGuildData(client, options = {}) {
  if (!client) {
    return {
      skipped: true,
      reason: "missing-client",
      processedGuilds: 0,
      failedGuilds: 0,
      guildCount: 0,
    };
  }

  if (isGuildSyncRunning) {
    return {
      skipped: true,
      reason: "already-running",
      processedGuilds: 0,
      failedGuilds: 0,
      guildCount: client.guilds?.cache?.size || 0,
    };
  }

  isGuildSyncRunning = true;

  const startedAt = Date.now();
  let processedGuilds = 0;
  let failedGuilds = 0;

  try {
    const guilds = client.guilds.cache;

    for (const guild of guilds.values()) {
      const results = await Promise.allSettled([
        guildAvailableSync.execute(guild),
        guildMemberSync.execute(guild),
        guildChannelSync.execute(guild),
        saveAllGuildRoles(guild),
      ]);

      const hasFailure = results.some((result) => result.status === "rejected");
      if (hasFailure) {
        failedGuilds += 1;
      } else {
        processedGuilds += 1;
      }
    }

    const finishedAt = Date.now();

    if (options.log !== false) {
      logger.info(
        `✅ Full guild sync done: total=${guilds.size}, success=${processedGuilds}, failed=${failedGuilds}, durationMs=${finishedAt - startedAt}`,
      );
    }

    return {
      skipped: false,
      reason: null,
      processedGuilds,
      failedGuilds,
      guildCount: guilds.size,
      durationMs: finishedAt - startedAt,
    };
  } catch (error) {
    logger.error(`Błąd pełnej synchronizacji guildów: ${error}`);

    return {
      skipped: false,
      reason: "error",
      processedGuilds,
      failedGuilds,
      guildCount: client.guilds?.cache?.size || 0,
      error,
    };
  } finally {
    isGuildSyncRunning = false;
  }
}

module.exports = {
  syncAllGuildData,
};
