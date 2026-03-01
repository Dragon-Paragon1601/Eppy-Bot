const logger = require("../logger");
const pool = require("../events/mysql/connect");

const MAX_TIMEOUT_MS = 2_147_483_647;
const timers = new Map();
let tableReady = false;

function entryKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

async function ensureTable() {
  if (tableReady) return;

  if (!pool.isAvailable || !pool.isAvailable()) {
    throw new Error("MySQL is unavailable.");
  }

  await pool.query(
    `CREATE TABLE IF NOT EXISTS temp_bans (
      guild_id VARCHAR(32) NOT NULL,
      user_id VARCHAR(32) NOT NULL,
      moderator_id VARCHAR(32) NULL,
      reason VARCHAR(512) NULL,
      expires_at BIGINT NOT NULL,
      created_at BIGINT NOT NULL,
      PRIMARY KEY (guild_id, user_id),
      KEY idx_temp_bans_expires_at (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );

  tableReady = true;
}

async function readStore() {
  try {
    await ensureTable();
    const [rows] = await pool.query(
      "SELECT guild_id, user_id, moderator_id, reason, expires_at, created_at FROM temp_bans",
    );

    return rows.map((row) => ({
      guildId: row.guild_id,
      userId: row.user_id,
      moderatorId: row.moderator_id || null,
      reason: row.reason || null,
      expiresAt: Number(row.expires_at),
      createdAt: Number(row.created_at),
    }));
  } catch (error) {
    logger.error(`readStore tempBans DB error: ${error}`);
    return [];
  }
}

async function upsertEntry(entry) {
  await ensureTable();
  await pool.query(
    `INSERT INTO temp_bans (guild_id, user_id, moderator_id, reason, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       moderator_id = VALUES(moderator_id),
       reason = VALUES(reason),
       expires_at = VALUES(expires_at),
       created_at = VALUES(created_at)`,
    [
      entry.guildId,
      entry.userId,
      entry.moderatorId,
      entry.reason,
      entry.expiresAt,
      entry.createdAt,
    ],
  );
}

async function removeEntry(guildId, userId) {
  try {
    await ensureTable();
    await pool.query(
      "DELETE FROM temp_bans WHERE guild_id = ? AND user_id = ?",
      [guildId, userId],
    );
  } catch (error) {
    logger.error(`removeEntry tempBans DB error: ${error}`);
  }
}

async function performUnban(client, entry) {
  const { guildId, userId, reason } = entry;

  try {
    const guild =
      client.guilds.cache.get(guildId) || (await client.guilds.fetch(guildId));

    if (!guild) {
      logger.warn(`TempBan: guild ${guildId} not found for user ${userId}`);
      return;
    }

    const unbanReason = `Temporary ban expired${
      reason ? ` | ${reason}` : ""
    }`.slice(0, 512);

    await guild.members.unban(userId, unbanReason);
    logger.info(`TempBan: unbanned ${userId} in guild ${guildId}`);
  } catch (error) {
    logger.error(`TempBan unban error for ${userId} in ${guildId}: ${error}`);
  } finally {
    await clearScheduledTempBan(guildId, userId);
  }
}

function scheduleTimer(client, entry) {
  const key = entryKey(entry.guildId, entry.userId);
  const existing = timers.get(key);
  if (existing) {
    clearTimeout(existing);
    timers.delete(key);
  }

  const remaining = entry.expiresAt - Date.now();
  if (remaining <= 0) {
    void performUnban(client, entry);
    return;
  }

  const delay = Math.min(remaining, MAX_TIMEOUT_MS);
  const timer = setTimeout(() => {
    const stillRemaining = entry.expiresAt - Date.now();
    if (stillRemaining > 0) {
      scheduleTimer(client, entry);
      return;
    }

    void performUnban(client, entry);
  }, delay);

  timers.set(key, timer);
}

async function scheduleTempBan(client, entry) {
  if (
    !entry ||
    typeof entry.guildId !== "string" ||
    typeof entry.userId !== "string" ||
    !Number.isFinite(entry.expiresAt)
  ) {
    throw new Error("Invalid temp ban entry.");
  }

  const safeEntry = {
    guildId: entry.guildId,
    userId: entry.userId,
    moderatorId: entry.moderatorId || null,
    reason: entry.reason || null,
    expiresAt: Number(entry.expiresAt),
    createdAt: Number(entry.createdAt || Date.now()),
  };

  await upsertEntry(safeEntry);
  scheduleTimer(client, safeEntry);
}

async function clearScheduledTempBan(guildId, userId) {
  const key = entryKey(guildId, userId);
  const existing = timers.get(key);
  if (existing) {
    clearTimeout(existing);
    timers.delete(key);
  }

  await removeEntry(guildId, userId);
}

async function restoreTempBans(client) {
  if (!pool.isAvailable || !pool.isAvailable()) {
    logger.warn(
      "TempBan: MySQL unavailable, temporary bans cannot survive bot restart.",
    );
    return;
  }

  const entries = await readStore();

  if (!entries.length) {
    return;
  }

  for (const entry of entries) {
    scheduleTimer(client, entry);
  }

  logger.info(`TempBan: restored ${entries.length} scheduled unban(s).`);
}

function parseDurationToMs(value) {
  if (!value) return null;

  const normalized = String(value).trim().toLowerCase();
  const match = normalized.match(/^(\d+)\s*(s|m|h|d)$/i);
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  const ms = amount * multipliers[unit];
  if (!Number.isFinite(ms) || ms <= 0) return null;

  return ms;
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds && parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(" ");
}

module.exports = {
  scheduleTempBan,
  restoreTempBans,
  clearScheduledTempBan,
  parseDurationToMs,
  formatDuration,
};
