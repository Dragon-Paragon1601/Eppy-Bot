-- Servers table (used by guildAvailable.js)
CREATE TABLE IF NOT EXISTS servers (
  id VARCHAR(32) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  owner_id VARCHAR(32),
  icon VARCHAR(512),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Music control commands sent from website to bot
CREATE TABLE IF NOT EXISTS music_command_queue (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  guild_id VARCHAR(32) NOT NULL,
  action VARCHAR(64) NOT NULL,
  payload_json LONGTEXT NULL,
  requested_by VARCHAR(32) NULL,
  status ENUM('pending','processing','done','failed') NOT NULL DEFAULT 'pending',
  result_message VARCHAR(512) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_music_cmd_status_created (status, created_at),
  KEY idx_music_cmd_guild_status (guild_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Current music state snapshot per guild for website polling
CREATE TABLE IF NOT EXISTS guild_music_state (
  guild_id VARCHAR(32) NOT NULL PRIMARY KEY,
  playback_state VARCHAR(16) NOT NULL DEFAULT 'idle',
  channel_label VARCHAR(255) NULL,
  now_playing_title VARCHAR(255) NULL,
  now_playing_artist VARCHAR(255) NULL,
  is_shuffle_enabled TINYINT(1) NOT NULL DEFAULT 0,
  is_loop_enabled TINYINT(1) NOT NULL DEFAULT 0,
  queue_json LONGTEXT NULL,
  priority_queue_json LONGTEXT NULL,
  previous_queue_json LONGTEXT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Synced music library from bot filesystem
CREATE TABLE IF NOT EXISTS music_library_tracks (
  track_key VARCHAR(512) NOT NULL PRIMARY KEY,
  track_path TEXT NOT NULL,
  playlist_name VARCHAR(255) NULL,
  title VARCHAR(255) NOT NULL,
  artist VARCHAR(255) NULL,
  duration_seconds INT NOT NULL DEFAULT 0,
  duration_label VARCHAR(16) NOT NULL DEFAULT '--:--',
  source_type ENUM('root','folder') NOT NULL DEFAULT 'folder',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_music_library_playlist (playlist_name),
  KEY idx_music_library_title (title)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User-created playlists scoped per guild
CREATE TABLE IF NOT EXISTS guild_music_playlists (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  guild_id VARCHAR(32) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_by VARCHAR(32) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_guild_playlist_name (guild_id, name),
  KEY idx_guild_music_playlists_guild (guild_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tracks assigned to user-created playlists
CREATE TABLE IF NOT EXISTS guild_music_playlist_tracks (
  playlist_id BIGINT UNSIGNED NOT NULL,
  track_key VARCHAR(512) NOT NULL,
  position INT NOT NULL DEFAULT 0,
  added_by VARCHAR(32) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (playlist_id, track_key),
  KEY idx_guild_music_playlist_tracks_position (playlist_id, position),
  CONSTRAINT fk_guild_music_playlist_tracks_playlist FOREIGN KEY (playlist_id) REFERENCES guild_music_playlists(id) ON DELETE CASCADE,
  CONSTRAINT fk_guild_music_playlist_tracks_track FOREIGN KEY (track_key) REFERENCES music_library_tracks(track_key) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Queue channels mapping (guild -> channel id)
CREATE TABLE IF NOT EXISTS queue_channels (
  guild_id VARCHAR(32) NOT NULL PRIMARY KEY,
  queue_channel_id VARCHAR(32) NOT NULL,
  selected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  selected_by VARCHAR(32) NULL,
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

-- Roles mapping (guild + role -> role snapshot)
CREATE TABLE IF NOT EXISTS guild_roles (
  guild_id VARCHAR(32) NOT NULL,
  role_id VARCHAR(32) NOT NULL,
  role_name VARCHAR(255) NOT NULL,
  role_color INT UNSIGNED NOT NULL DEFAULT 0,
  permission_level TINYINT NOT NULL DEFAULT 0,
  permissions_bitfield VARCHAR(32) NOT NULL,
  position INT NOT NULL DEFAULT 0,
  is_hoist TINYINT(1) NOT NULL DEFAULT 0,
  is_mentionable TINYINT(1) NOT NULL DEFAULT 0,
  is_managed TINYINT(1) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (guild_id, role_id),
  KEY idx_guild_roles_guild_id (guild_id),
  KEY idx_guild_roles_position (guild_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Notification channels mapping (guild -> channel id)
CREATE TABLE IF NOT EXISTS notification_channels (
  guild_id VARCHAR(32) NOT NULL PRIMARY KEY,
  notification_channel_id VARCHAR(32) NOT NULL,
  selected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  selected_by VARCHAR(32) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Welcome channels mapping (guild -> channel id)
CREATE TABLE IF NOT EXISTS welcome_channels (
  guild_id VARCHAR(32) NOT NULL PRIMARY KEY,
  welcome_channel_id VARCHAR(32) NOT NULL,
  selected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  selected_by VARCHAR(32) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Update notification channels mapping (guild -> channel id)
CREATE TABLE IF NOT EXISTS update_notification_channels (
  guild_id VARCHAR(32) NOT NULL PRIMARY KEY,
  update_notification_channel_id VARCHAR(32) NOT NULL,
  selected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  selected_by VARCHAR(32) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Update notification role mapping (guild -> role id)
CREATE TABLE IF NOT EXISTS update_notification_roles (
  guild_id VARCHAR(32) NOT NULL PRIMARY KEY,
  notification_role_id VARCHAR(32) NOT NULL,
  selected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  selected_by VARCHAR(32) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Generic notification role mapping (guild -> role id)
CREATE TABLE IF NOT EXISTS notification_roles (
  guild_id VARCHAR(32) NOT NULL PRIMARY KEY,
  notification_role_id VARCHAR(32) NOT NULL,
  selected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  selected_by VARCHAR(32) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ban notification channel mapping (guild -> channel id)
CREATE TABLE IF NOT EXISTS ban_notification_channels (
  guild_id VARCHAR(32) NOT NULL PRIMARY KEY,
  ban_notification_channel_id VARCHAR(32) NOT NULL,
  selected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  selected_by VARCHAR(32) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Kick notification channel mapping (guild -> channel id)
CREATE TABLE IF NOT EXISTS kick_notification_channels (
  guild_id VARCHAR(32) NOT NULL PRIMARY KEY,
  kick_notification_channel_id VARCHAR(32) NOT NULL,
  selected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  selected_by VARCHAR(32) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Notification toggles (category + per-notification channel)
CREATE TABLE IF NOT EXISTS guild_notification_settings (
  guild_id VARCHAR(32) NOT NULL PRIMARY KEY,
  notifications_enabled TINYINT(1) NOT NULL DEFAULT 1,
  queue_notifications_enabled TINYINT(1) NOT NULL DEFAULT 1,
  welcome_notifications_enabled TINYINT(1) NOT NULL DEFAULT 0,
  ban_notifications_enabled TINYINT(1) NOT NULL DEFAULT 1,
  kick_notifications_enabled TINYINT(1) NOT NULL DEFAULT 1,
  notification_channel_enabled TINYINT(1) NOT NULL DEFAULT 0,
  update_notification_channel_enabled TINYINT(1) NOT NULL DEFAULT 0,
  selected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  selected_by VARCHAR(32) NULL
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