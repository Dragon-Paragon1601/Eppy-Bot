const { Client } = require('discord.js');
const logger = require("./../../logger");

/**
 * Ustawia status bota Discord.
 * 
 * @param {Client} client - Instancja klienta Discord.
 * @param {string} status - Status bota (online, idle, dnd, invisible).
 * @param {number} activityType - Typ aktywności (0 - Playing, 1 - Streaming, 2 - Listening, 3 - Watching, 5 - Competing).
 * @param {string} activityName - Nazwa aktywności (opis, np. "Minecraft").
 * @param {string} stateName - Nazwa stanu (np. "Eppy Bot (1 z 1)").
 * @param {string} [streamURL] - URL streama (opcjonalnie, wymagane dla STREAMING).
 */
function setBotPresence(client, status, activityType, activityName, stateName, streamURL = '') {
    // Sprawdź, czy typ aktywności jest prawidłowy
    if (![0, 1, 2, 3, 5].includes(activityType)) {
        logger.error(`❌ Błąd: Nieprawidłowy typ aktywności: ${activityType}`);
        return;
    }

    try {
        // Ustaw status bota i aktywność
        client.user.setPresence({
            status: status, 
            activities: [{
                name: activityName,
                type: activityType,
                state: stateName,
                url: activityType === 1 ? streamURL : null,
            }],
        });

        logger.info(`✅ Status bota zmieniony: ${status} | Typ: ${activityType} | Opis: ${activityName}`);
    } catch (error) {
        logger.error(`❌ Błąd w setBotPresence: ${error}`);
    }
}

module.exports = { setBotPresence };