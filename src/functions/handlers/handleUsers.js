const User = require("../../schemas/users");
const logger = require("../../logger");

async function saveAllGuildUsers(guild) {
  if (!guild) {
    logger.error("[ERROR] Brak guild - przerwano zapis.");
    return;
  }

  try {
    const members = await guild.members.fetch(); // Pobieramy wszystkich członków

    for (const member of members.values()) {
      let adminPrem = 0;

      // Określenie uprawnień użytkownika
      if (member.permissions.has("Administrator")) {
        adminPrem = 8;
      } else if (member.permissions.has("ManageGuild")) {
        adminPrem = 6;
      } else if (member.permissions.has("ManageRoles")) {
        adminPrem = 4;
      }

      // Sprawdzamy, czy użytkownik już istnieje w bazie danych
      const existingUser = await User.findOne({ guild_id: guild.id, user_id: member.id });

      if (existingUser) {
        // Jeśli użytkownik istnieje, zaktualizuj dane
        existingUser.admin_prem = adminPrem;
        existingUser.username = member.user.username;
        existingUser.guild_name = guild.name; // Aktualizujemy nazwę serwera
        existingUser.guild_icon = guild.iconURL() || null; // Aktualizujemy ikonę serwera
        await existingUser.save();
      } else {
        // Jeśli użytkownik nie istnieje, dodaj nowego użytkownika
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
    logger.error("[ERROR] Błąd podczas zapisu użytkowników do MongoDB:", error);
  }
}

module.exports = { saveAllGuildUsers };
