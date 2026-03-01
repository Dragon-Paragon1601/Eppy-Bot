-- Servers table (used by guildAvailable.js)
CREATE TABLE IF NOT EXISTS servers (
  id VARCHAR(32) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  owner_id VARCHAR(32),
  icon VARCHAR(512),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Queue channels mapping (guild -> channel id)
CREATE TABLE IF NOT EXISTS queue_channels (
  guild_id VARCHAR(32) NOT NULL PRIMARY KEY,
  queue_channel_id VARCHAR(32) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Users mapping (guild + user -> permissions/profile snapshot)
CREATE TABLE IF NOT EXISTS users (
  guild_id VARCHAR(32) NOT NULL,
  user_id VARCHAR(32) NOT NULL,
  admin_prem TINYINT NOT NULL DEFAULT 0,
  username VARCHAR(255) NOT NULL,
  guild_name VARCHAR(255) NOT NULL,
  guild_icon VARCHAR(512) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (guild_id, user_id),
  KEY idx_users_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Channels mapping (guild + channel -> channel snapshot)
CREATE TABLE IF NOT EXISTS channels (
  guild_id VARCHAR(32) NOT NULL,
  channel_id VARCHAR(32) NOT NULL,
  channel_name VARCHAR(255) NOT NULL,
  channel_type VARCHAR(64) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (guild_id, channel_id),
  KEY idx_channels_channel_id (channel_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Notification channels mapping (guild -> channel id)
CREATE TABLE IF NOT EXISTS notification_channels (
  guild_id VARCHAR(32) NOT NULL PRIMARY KEY,
  notification_channel_id VARCHAR(32) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Welcome channels mapping (guild -> channel id)
CREATE TABLE IF NOT EXISTS welcome_channels (
  guild_id VARCHAR(32) NOT NULL PRIMARY KEY,
  welcome_channel_id VARCHAR(32) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Update notification channels mapping (guild -> channel id)
CREATE TABLE IF NOT EXISTS update_notification_channels (
  guild_id VARCHAR(32) NOT NULL PRIMARY KEY,
  update_notification_channel_id VARCHAR(32) NOT NULL,
  selected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Update notification role mapping (guild -> role id)
CREATE TABLE IF NOT EXISTS update_notification_roles (
  guild_id VARCHAR(32) NOT NULL PRIMARY KEY,
  notification_role_id VARCHAR(32) NOT NULL,
  selected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ban notification channel mapping (guild -> channel id)
CREATE TABLE IF NOT EXISTS ban_notification_channels (
  guild_id VARCHAR(32) NOT NULL PRIMARY KEY,
  ban_notification_channel_id VARCHAR(32) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Kick notification channel mapping (guild -> channel id)
CREATE TABLE IF NOT EXISTS kick_notification_channels (
  guild_id VARCHAR(32) NOT NULL PRIMARY KEY,
  kick_notification_channel_id VARCHAR(32) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Temporary bans persistence (required for restart-safe auto-unban)
CREATE TABLE IF NOT EXISTS temp_bans (
  guild_id VARCHAR(32) NOT NULL,
  user_id VARCHAR(32) NOT NULL,
  moderator_id VARCHAR(32) NULL,
  reason VARCHAR(512) NULL,
  expires_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (guild_id, user_id),
  KEY idx_temp_bans_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Server information table
CREATE TABLE IF NOT EXISTS servers (
  id VARCHAR(32) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  owner_id VARCHAR(32),
  icon VARCHAR(512),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;