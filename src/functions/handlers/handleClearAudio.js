const fs = require("fs");
const path = require("path");
const logger = require("./../../logger");
const runtimeStore = require("../../database/runtimeStore");
const audioBaseDir = path.join(__dirname, "../../../audio");

async function clearAudioFolders() {
  if (!fs.existsSync(audioBaseDir)) {
    logger.info("📂 Folder bazowy audio nie istnieje.");
    return;
  }

  // Pobierz wszystkie kolejki z bazy danych
  const queues = await runtimeStore.getAllQueues();
  const activeGuilds = queues.map((queue) => queue.guildId);

  // Przejdź przez foldery gildii
  fs.readdir(audioBaseDir, (err, guildFolders) => {
    if (err) {
      logger.error(`❌ Nie można odczytać zawartości folderu audio: ${err}`);
      return;
    }

    guildFolders.forEach((guildId) => {
      if (!activeGuilds.includes(guildId)) {
        logger.info(`⚠️ Gildia ${guildId} nie ma aktywnej kolejki - pomijam.`);
        return;
      }

      const queue = queues.find((queue) => queue.guildId === guildId);
      if (queue && queue.songs.length > 0) {
        logger.info(
          `✅ Kolejka dla gildii ${guildId} NIE jest pusta - pomijam usuwanie.`,
        );
        return;
      }

      const guildAudioDir = path.join(audioBaseDir, guildId);
      fs.readdir(guildAudioDir, (err, files) => {
        if (err) {
          logger.error(
            `❌ Nie można odczytać zawartości folderu ${guildId}: ${err}`,
          );
          return;
        }

        files.forEach((file) => {
          const filePath = path.join(guildAudioDir, file);
          fs.unlink(filePath, (err) => {
            if (err) {
              logger.error(`❌ Błąd przy usuwaniu pliku ${filePath}: ${err}`);
            } else {
              logger.debug(`🗑️ Usunięto plik: ${filePath}`);
            }
          });
        });
      });
    });
  });
}

module.exports = { clearAudioFolders };
