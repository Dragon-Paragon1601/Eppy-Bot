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

-- Server information table
CREATE TABLE IF NOT EXISTS servers (
  id VARCHAR(32) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  owner_id VARCHAR(32),
  icon VARCHAR(512),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;