const User = require("../../schemas/users");
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

      // Check if the user already exists in the database
      const existingUser = await User.findOne({
        guild_id: guild.id,
        user_id: member.id,
      });

      if (existingUser) {
        // If the user exists, update the data
        existingUser.admin_prem = adminPrem;
        existingUser.username = member.user.username;
        existingUser.guild_name = guild.name; // Aktualizujemy nazwę serwera
        existingUser.guild_icon = guild.iconURL() || null; // Aktualizujemy ikonę serwera
        await existingUser.save();
      } else {
        // If the user does not exist, add a new user
        const newUser = new User({
          guild_id: guild.id,
          user_id: member.id,
          username: member.user.username,
          admin_prem: adminPrem,
          guild_name: guild.name, // Dodajemy nazwę serwera
          guild_icon: guild.iconURL() || null, // Dodajemy ikonę serwera
        });
        await newUser.save();
      }
    }
  } catch (error) {
    logger.error("[ERROR] Error saving users to MongoDB:", error);
  }
}

module.exports = { saveAllGuildUsers };
