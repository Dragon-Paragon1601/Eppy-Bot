const fs = require('fs');
const path = require('path');
const logger = require("./../../logger");
const { clearAudioFolder } = require('../../functions/handlers/handleClearAudio');

function autoClearAudio(guildId) {
    if (!guildId) {
        logger.error("❌ Brak ID gildii! Nie można wyczyścić kolejki.");
        return;
    }

    const queueFilePath = path.join(__dirname, `../../../music/queue/${guildId}/queue_${guildId}.json`);

    if (!fs.existsSync(queueFilePath)) {
        logger.debug(`🚫 Plik kolejki dla gildii ${guildId} nie istnieje. Usuwanie plików audio...`);
        clearAudioFolder(guildId);
        return;
    }

    try {
        const queueContent = fs.readFileSync(queueFilePath, 'utf-8');
        const queue = JSON.parse(queueContent);

        if (!Array.isArray(queue) || queue.length === 0) {
            logger.info(`🗑️ Kolejka dla gildii ${guildId} jest pusta. Usuwanie plików audio...`);
            clearAudioFolder(guildId);
        } else {
            logger.info(`🎵 W kolejce gildii ${guildId} są jeszcze piosenki. Pliki audio pozostają bez zmian.`);
        }
    } catch (error) {
        logger.error(`❌ Błąd podczas odczytu pliku kolejki dla gildii ${guildId}: ${error}`);
    }
}

module.exports = { autoClearAudio };
