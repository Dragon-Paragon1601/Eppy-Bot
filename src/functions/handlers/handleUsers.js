const pool = require("../../events/mysql/connect");
const logger = require("../../logger");

function resolveAdminPrem(member) {
  if (!member) {
    return 0;
  }

  if (member.permissions.has("Administrator")) {
    return 8;
  }

  if (member.permissions.has("ManageGuild")) {
    return 6;
  }

  if (member.permissions.has("ManageRoles")) {
    return 4;
  }

  return 0;
}

async function upsertGuildMember(member) {
  if (!member?.guild || !member?.user) {
    return;
  }

  const guild = member.guild;
  const adminPrem = resolveAdminPrem(member);

  await pool.query(
    "INSERT INTO users (guild_id, user_id, admin_prem, username, guild_name, guild_icon) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE admin_prem = VALUES(admin_prem), username = VALUES(username), guild_name = VALUES(guild_name), guild_icon = VALUES(guild_icon), updated_at = CURRENT_TIMESTAMP",
    [
      guild.id,
      member.id,
      adminPrem,
      member.user.username,
      guild.name,
      member.user.displayAvatarURL() || null,
    ],
  );
}

async function removeGuildMember(guildId, userId) {
  if (!guildId || !userId) {
    return;
  }

  await pool.query("DELETE FROM users WHERE guild_id = ? AND user_id = ?", [
    guildId,
    userId,
  ]);
}

async function saveAllGuildUsers(guild) {
  if (!guild) {
    logger.error("[ERROR] No guild provided - aborting save.");
    return;
  }

  try {
    const members = await guild.members.fetch(); // Fetch all members

    for (const member of members.values()) {
      await upsertGuildMember(member);
    }
  } catch (error) {
    logger.error(`[ERROR] Error saving users to MySQL: ${error}`);
  }
}

module.exports = {
  saveAllGuildUsers,
  upsertGuildMember,
  removeGuildMember,
};
