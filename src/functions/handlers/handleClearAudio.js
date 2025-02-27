const fs = require("fs");
const path = require("path");
const logger = require("./../../logger");
const audioBaseDir = path.join(__dirname, "../../../music/audio");
const queueBaseDir = path.join(__dirname, "../../../music/queue");

function clearAudioFolders() {
    if (!fs.existsSync(audioBaseDir)) {
        logger.info("📂 Folder bazowy audio nie istnieje.");
        return;
    }

    // Pobierz pliki kolejki
    const queueFiles = fs.readdirSync(queueBaseDir).filter(file => file.startsWith("queue_") && file.endsWith(".json"));
    const activeGuilds = queueFiles.map(file => file.replace("queue_", "").replace(".json", ""));

    // Przejdź przez foldery gildii
    fs.readdir(audioBaseDir, (err, guildFolders) => {
        if (err) {
            logger.error(`❌ Nie można odczytać zawartości folderu audio: ${err}`);
            return;
        }

        guildFolders.forEach(guildId => {
            if (!activeGuilds.includes(guildId)) {
                logger.info(`⚠️ Gildia ${guildId} nie ma aktywnej kolejki - pomijam.`);
                return;
            }

            const guildQueuePath = path.join(queueBaseDir, `queue_${guildId}.json`);
            let queue = [];

            try {
                const queueData = fs.readFileSync(guildQueuePath, "utf-8");
                queue = JSON.parse(queueData);
            } catch (readError) {
                logger.error(`❌ Błąd odczytu kolejki dla ${guildId}: ${readError}`);
                return;
            }

            if (queue.length > 0) {
                logger.info(`✅ Kolejka dla gildii ${guildId} NIE jest pusta - pomijam usuwanie.`);
                return;
            }

            const guildAudioDir = path.join(audioBaseDir, guildId);
            fs.readdir(guildAudioDir, (err, files) => {
                if (err) {
                    logger.error(`❌ Nie można odczytać zawartości folderu ${guildId}: ${err}`);
                    return;
                }

                files.forEach(file => {
                    const filePath = path.join(guildAudioDir, file);
                    fs.unlink(filePath, err => {
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