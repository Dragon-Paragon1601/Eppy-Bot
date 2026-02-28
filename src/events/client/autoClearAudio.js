// const fs = require('fs');
// const path = require('path');
// const logger = require("./../../logger");
// const { clearAudioFolder } = require('../../functions/handlers/handleClearAudio');
// const Queue = require("../../schemas/queue");

// async function autoClearAudio(guildId) {
//     if (!guildId) {
//         logger.error("❌ Brak ID gildii! Nie można wyczyścić kolejki.");
//         return;
//     }

//     try {
//         const queue = await Queue.findOne({ guildId });

//         if (!queue || !Array.isArray(queue.songs) || queue.songs.length === 0) {
//             logger.info(`🗑️ Kolejka dla gildii ${guildId} jest pusta. Usuwanie plików audio...`);
//             clearAudioFolder(guildId);
//         } else {
//             logger.info(`🎵 W kolejce gildii ${guildId} są jeszcze piosenki. Pliki audio pozostają bez zmian.`);
//         }
//     } catch (error) {
//         logger.error(`❌ Błąd podczas odczytu kolejki dla gildii ${guildId}: ${error}`);
//     }
// }

// module.exports = { autoClearAudio };
