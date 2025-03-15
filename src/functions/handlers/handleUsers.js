const User = require("../../schemas/users");
const logger = require("../../logger");

async function saveAllGuildUsers(guild) {
  if (!guild) {
    logger.error("[ERROR] Brak guild - przerwano zapis.");
    return;
  }

  logger.debug(`[LOG] Pobieranie użytkowników dla serwera: ${guild.name} (${guild.id})`);

  try {
    const members = await guild.members.fetch();
    logger.debug(`[LOG] Znaleziono ${members.size} użytkowników`);

    for (const member of members.values()) {
      let adminPrem = 0;

      if (member.permissions.has("Administrator")) {
        adminPrem = 8;
      } else if (member.permissions.has("ManageGuild")) {
        adminPrem = 6;
      } else if (member.permissions.has("ManageRoles")) {
        adminPrem = 4;
      }

      logger.debug(`[LOG] ${member.user.tag} - admin_prem: ${adminPrem}`);

      const existingUser = await User.findOne({ guild_id: guild.id, user_id: member.id });

      if (existingUser) {
        existingUser.admin_prem = adminPrem;
        existingUser.username = member.user.username;
        existingUser.guild_name = guild.name; // Aktualizujemy nazwę serwera
        existingUser.guild_icon = guild.iconURL() || null; // Aktualizujemy ikonę serwera
        await existingUser.save();
        logger.debug(`[LOG] Zaktualizowano użytkownika: ${member.user.tag}`);
      } else {
        const newUser = new User({
          guild_id: guild.id,
          user_id: member.id,
          username: member.user.username,
          admin_prem: adminPrem,
          guild_name: guild.name, // Dodajemy nazwę serwera
          guild_icon: guild.iconURL() || null, // Dodajemy ikonę serwera
        });
        await newUser.save();
        logger.debug(`[LOG] Dodano nowego użytkownika: ${member.user.tag}`);
      }
    }
  } catch (error) {
    logger.error("[ERROR] Błąd podczas zapisu użytkowników do MongoDB:", error);
  }
}

module.exports = { saveAllGuildUsers };
