const pool = require("../../events/mysql/connect");
const logger = require("../../logger");

const CREATE_GUILD_ROLES_TABLE_SQL = `
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

function resolvePermissionLevel(role) {
  if (role.permissions.has("Administrator")) {
    return 8;
  }

  if (role.permissions.has("ManageGuild")) {
    return 6;
  }

  if (role.permissions.has("ManageRoles")) {
    return 4;
  }

  return 0;
}

async function saveAllGuildRoles(guild) {
  if (!guild) {
    logger.error("[ERROR] No guild provided - aborting role sync.");
    return;
  }

  try {
    await pool.query(CREATE_GUILD_ROLES_TABLE_SQL);

    const roles = await guild.roles.fetch();
    const roleIds = [];

    for (const role of roles.values()) {
      const roleId = String(role.id);
      roleIds.push(roleId);

      await pool.query(
        `INSERT INTO guild_roles (
          guild_id,
          role_id,
          role_name,
          role_color,
          permission_level,
          permissions_bitfield,
          position,
          is_hoist,
          is_mentionable,
          is_managed
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          role_name = VALUES(role_name),
          role_color = VALUES(role_color),
          permission_level = VALUES(permission_level),
          permissions_bitfield = VALUES(permissions_bitfield),
          position = VALUES(position),
          is_hoist = VALUES(is_hoist),
          is_mentionable = VALUES(is_mentionable),
          is_managed = VALUES(is_managed),
          updated_at = CURRENT_TIMESTAMP`,
        [
          guild.id,
          roleId,
          role.name,
          role.color || 0,
          resolvePermissionLevel(role),
          String(role.permissions?.bitfield ?? 0n),
          Number(role.position || 0),
          role.hoist ? 1 : 0,
          role.mentionable ? 1 : 0,
          role.managed ? 1 : 0,
        ],
      );
    }

    if (!roleIds.length) {
      await pool.query("DELETE FROM guild_roles WHERE guild_id = ?", [
        guild.id,
      ]);
      return;
    }

    await pool.query(
      "DELETE FROM guild_roles WHERE guild_id = ? AND role_id NOT IN (?)",
      [guild.id, roleIds],
    );
  } catch (error) {
    logger.error(`[ERROR] Error saving roles to MySQL: ${error}`);
  }
}

module.exports = { saveAllGuildRoles };
