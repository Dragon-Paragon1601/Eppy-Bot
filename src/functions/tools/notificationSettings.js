const pool = require("../../events/mysql/connect");
const logger = require("../../logger");

const DEFAULT_NOTIFICATION_SETTINGS = {
  notifications_enabled: true,
  queue_notifications_enabled: true,
  welcome_notifications_enabled: false,
  ban_notifications_enabled: true,
  kick_notifications_enabled: true,
  notification_channel_enabled: false,
  update_notification_channel_enabled: false,
};

let ensuredTable = false;

function asBool(value, fallback) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1") return true;
  if (value === 0 || value === "0") return false;
  return fallback;
}

async function ensureNotificationSettingsTable() {
  if (ensuredTable) return;

  try {
    await pool.query(
      "CREATE TABLE IF NOT EXISTS guild_notification_settings (guild_id VARCHAR(32) NOT NULL PRIMARY KEY, notifications_enabled TINYINT(1) NOT NULL DEFAULT 1, queue_notifications_enabled TINYINT(1) NOT NULL DEFAULT 1, welcome_notifications_enabled TINYINT(1) NOT NULL DEFAULT 0, ban_notifications_enabled TINYINT(1) NOT NULL DEFAULT 1, kick_notifications_enabled TINYINT(1) NOT NULL DEFAULT 1, notification_channel_enabled TINYINT(1) NOT NULL DEFAULT 0, update_notification_channel_enabled TINYINT(1) NOT NULL DEFAULT 0, selected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, selected_by VARCHAR(32) NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
    );
    ensuredTable = true;
  } catch (err) {
    logger.error(`notification settings table ensure error: ${err}`);
  }
}

function normalizeSettings(input = {}) {
  return {
    notifications_enabled: asBool(
      input.notifications_enabled,
      DEFAULT_NOTIFICATION_SETTINGS.notifications_enabled,
    ),
    queue_notifications_enabled: asBool(
      input.queue_notifications_enabled,
      DEFAULT_NOTIFICATION_SETTINGS.queue_notifications_enabled,
    ),
    welcome_notifications_enabled: asBool(
      input.welcome_notifications_enabled,
      DEFAULT_NOTIFICATION_SETTINGS.welcome_notifications_enabled,
    ),
    ban_notifications_enabled: asBool(
      input.ban_notifications_enabled,
      DEFAULT_NOTIFICATION_SETTINGS.ban_notifications_enabled,
    ),
    kick_notifications_enabled: asBool(
      input.kick_notifications_enabled,
      DEFAULT_NOTIFICATION_SETTINGS.kick_notifications_enabled,
    ),
    notification_channel_enabled: asBool(
      input.notification_channel_enabled,
      DEFAULT_NOTIFICATION_SETTINGS.notification_channel_enabled,
    ),
    update_notification_channel_enabled: asBool(
      input.update_notification_channel_enabled,
      DEFAULT_NOTIFICATION_SETTINGS.update_notification_channel_enabled,
    ),
  };
}

async function upsertGuildNotificationSettings(
  guildId,
  settings,
  selectedBy = null,
) {
  await ensureNotificationSettingsTable();
  const normalized = normalizeSettings(settings);

  await pool.query(
    `INSERT INTO guild_notification_settings (
      guild_id,
      notifications_enabled,
      queue_notifications_enabled,
      welcome_notifications_enabled,
      ban_notifications_enabled,
      kick_notifications_enabled,
      notification_channel_enabled,
      update_notification_channel_enabled,
      selected_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      notifications_enabled = VALUES(notifications_enabled),
      queue_notifications_enabled = VALUES(queue_notifications_enabled),
      welcome_notifications_enabled = VALUES(welcome_notifications_enabled),
      ban_notifications_enabled = VALUES(ban_notifications_enabled),
      kick_notifications_enabled = VALUES(kick_notifications_enabled),
      notification_channel_enabled = VALUES(notification_channel_enabled),
      update_notification_channel_enabled = VALUES(update_notification_channel_enabled),
      selected_by = VALUES(selected_by),
      selected_at = CURRENT_TIMESTAMP`,
    [
      guildId,
      normalized.notifications_enabled ? 1 : 0,
      normalized.queue_notifications_enabled ? 1 : 0,
      normalized.welcome_notifications_enabled ? 1 : 0,
      normalized.ban_notifications_enabled ? 1 : 0,
      normalized.kick_notifications_enabled ? 1 : 0,
      normalized.notification_channel_enabled ? 1 : 0,
      normalized.update_notification_channel_enabled ? 1 : 0,
      selectedBy,
    ],
  );

  return normalized;
}

async function getGuildNotificationSettings(guildId, options = {}) {
  const { ensureRow = false, selectedBy = null } = options;

  await ensureNotificationSettingsTable();

  const [rows] = await pool.query(
    "SELECT notifications_enabled, queue_notifications_enabled, welcome_notifications_enabled, ban_notifications_enabled, kick_notifications_enabled, notification_channel_enabled, update_notification_channel_enabled FROM guild_notification_settings WHERE guild_id = ? LIMIT 1",
    [guildId],
  );

  if (!rows.length) {
    if (ensureRow) {
      await upsertGuildNotificationSettings(
        guildId,
        DEFAULT_NOTIFICATION_SETTINGS,
        selectedBy,
      );
    }
    return { ...DEFAULT_NOTIFICATION_SETTINGS };
  }

  return normalizeSettings(rows[0]);
}

function isNotificationTypeEnabled(settings, key) {
  if (!settings || !settings.notifications_enabled) return false;
  return !!settings[key];
}

module.exports = {
  DEFAULT_NOTIFICATION_SETTINGS,
  ensureNotificationSettingsTable,
  normalizeSettings,
  getGuildNotificationSettings,
  upsertGuildNotificationSettings,
  isNotificationTypeEnabled,
};
