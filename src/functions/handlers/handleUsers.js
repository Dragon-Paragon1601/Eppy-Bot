const pool = require("../../events/mysql/connect");
const logger = require("../../logger");

async function saveAllGuildUsers(guild) {
  if (!guild) {
    logger.error("[ERROR] No guild provided - aborting save.");
    return;
  }

  try {
    const members = await guild.members.fetch(); // Fetch all members

    for (const member of members.values()) {
      let adminPrem = 0;

      // Determine user permissions
      if (member.permissions.has("Administrator")) {
        adminPrem = 8;
      } else if (member.permissions.has("ManageGuild")) {
        adminPrem = 6;
      } else if (member.permissions.has("ManageRoles")) {
        adminPrem = 4;
      }

      await pool.query(
        "INSERT INTO users (guild_id, user_id, admin_prem, username, guild_name, guild_icon) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE admin_prem = VALUES(admin_prem), username = VALUES(username), guild_name = VALUES(guild_name), guild_icon = VALUES(guild_icon), updated_at = CURRENT_TIMESTAMP",
        [
          guild.id,
          member.id,
          adminPrem,
          member.user.username,
          guild.name,
          guild.iconURL() || null,
        ],
      );
    }
  } catch (error) {
    logger.error(`[ERROR] Error saving users to MySQL: ${error}`);
  }
}

module.exports = { saveAllGuildUsers };
