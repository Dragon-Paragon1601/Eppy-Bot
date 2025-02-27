const path = require("path");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require("@discordjs/voice");
const configPath = path.join(__dirname, "./queueConfig.json");
const { clearAudioFolders } = require("./handleClearAudio");
const logger = require("./../../logger");
const mm = require('music-metadata');
const fs = require("fs");
const firstSongStartedMap = new Map();
let connections = {};
let idleTimers = {};
let isPlaying = {};
let players = {};
let queues = {};

// Sprawdź czy pierwsza piosenka została rozpoczęta
function checkFirstSongStarted(guildId) {
    if (!firstSongStartedMap.has(guildId)) {
        firstSongStartedMap.set(guildId, false); 
    }
    return firstSongStartedMap.get(guildId);
} 

// Pobierz kolejkę dla danej gildii
function getQueue(guildId) {
    const queuePath = path.join(__dirname, `../../../music/queue/queue_${guildId}.json`);
    if (!fs.existsSync(queuePath)) {
        return [];
    }
    try {
        const data = fs.readFileSync(queuePath, "utf-8");
        const parsedData = JSON.parse(data);
        return Array.isArray(parsedData) ? parsedData : [];
    } catch (error) {
        logger.error(`❌ Błąd odczytu kolejki dla ${guildId}: ${error}`);
        return [];
    }
}

// Zapisz kolejkę dla danej gildii
function saveQueue(guildId, queue) {
    const queueDir = path.join(__dirname, "../../../music/queue");
    const queuePath = path.join(queueDir, `queue_${guildId}.json`);

    if (!fs.existsSync(queueDir)) {
        fs.mkdirSync(queueDir, { recursive: true });
    }

    try {
        fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2), "utf-8");
    } catch (error) {
        logger.error(`❌ Błąd zapisu kolejki dla ${guildId}: ${error}`);
    }
}

// Dodaj piosenkę do kolejki
function addToQueue(guildId, songPath) {
    if (!queues[guildId]) queues[guildId] = [];
    queues[guildId].push(songPath);
    saveQueue(guildId, queues[guildId]);
}

// Wyczyść kolejkę dla danej gildii
function clearQueue(guildId) {
    queues[guildId] = [];
    saveQueue(guildId, []);
}

// Przetasuj kolejkę dla danej gildii
function shuffleQueue(guildId, shuffleTimes = 10) {
    let queue = getQueue(guildId);
    if (!queue || queue.length < 3) return;

    for (let n = 0; n < shuffleTimes; n++) { 
        for (let i = queue.length - 1; i > 1; i--) { 
            const j = Math.floor(Math.random() * (i - 1)) + 1; 
            [queue[i], queue[j]] = [queue[j], queue[i]];
        }
    }

    saveQueue(guildId, queue);
}

// Sprawdź czy muzyka jest odtwarzana
function isPlay(guildId) {
    return !!isPlaying[guildId];
}

// Zatrzymaj odtwarzanie muzyki
function playersStop(guildId) {
    const emptyResource = createAudioResource(Buffer.alloc(0)); 
    players[guildId].play(emptyResource);
}

// Sprawdź czy kolejka jest pusta
function queueEmpty(guildId, interaction) {
    let emptyCheck = getQueue(guildId); 
    if (emptyCheck.length === 0) {
        logger.debug(`🚫 Kolejka dla gildii ${guildId} jest pusta.`);
        if (interaction.channel) {
            interaction.channel.send("⌛ Queue is empty. Waiting for another song!");
        }
        clearAudioFolders(guildId);
        saveQueue(guildId, []);

        idleTimers[guildId] = setTimeout(() => {
            if (!queues[guildId]?.length && connections[guildId]) {
                connections[guildId].destroy();
                delete connections[guildId];
                logger.debug(`⏹️ Bot rozłączony z ${guildId} z powodu braku muzyki.`);
            }
        }, 180000);
        return;
    }
}

// Sformatuj czas w milisekundach na minuty i sekundy
function formatTime(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Utwórz pasek postępu dla odtwarzanej piosenki
function createProgressBar(currentTime, totalTime, barLength = 23) {
    if (isNaN(currentTime) || isNaN(totalTime) || totalTime === 0) return "[─────────────────]";
    let progress = Math.round((currentTime / totalTime) * barLength);
    progress = Math.max(0, Math.min(progress, barLength));
    return "█".repeat(progress) + "─".repeat(barLength - progress);
}

// Pobierz długość piosenki
async function getSongDuration(songPath) {
    try {
        const metadata = await mm.parseFile(songPath);
        return metadata.format.duration * 1000;
    } catch (err) {
        logger.error(`Błąd pobierania metadanych dla ${songPath}: ${err}`);
        return 0;
    }
}

// Odtwórz następną piosenkę w kolejce
async function playNext(guildId, interaction) {
    if (isPlaying[guildId]) {
        return;
    }

    let queue = getQueue(guildId);

    queueEmpty(guildId, interaction);

    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
        logger.debug(`🚫 Użytkownik opuścił kanał głosowy. Bot rozłącza się.`);
        connections[guildId]?.destroy();
        delete connections[guildId];
        return;
    }

    if (!connections[guildId] || connections[guildId].joinConfig.channelId !== voiceChannel.id) {
        if (connections[guildId]) {
            connections[guildId].destroy();
        }

        connections[guildId] = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: guildId,
            adapterCreator: interaction.guild.voiceAdapterCreator,
            selfDeaf: true,
        });

        logger.debug(`✅ Bot dołączył do kanału: ${voiceChannel.id} na serwerze ${guildId}`);
    }

    if (!connections[guildId]) {
        logger.error(`❌ Błąd: Bot nie mógł dołączyć do kanału głosowego na serwerze ${guildId}`);
        return;
    }

    const songPath = queue[0];  
    if (!songPath) {
        logger.error(`🚫 Błąd: Brak poprawnego utworu do odtworzenia dla ${guildId}`);
        return;
    }

    logger.info(`🎵 Odtwarzanie dla ${guildId}: ${path.basename(songPath, ".mp3").replace(/_/g, " ")}`);

    isPlaying[guildId] = true;

    const resource = createAudioResource(songPath);
    if (!players[guildId]) players[guildId] = createAudioPlayer();
    
    connections[guildId].subscribe(players[guildId]);
    players[guildId].play(resource);
    const songName = path.basename(songPath, ".mp3").replace(/_/g, " ");
    interaction.channel.send(`🎶 Now playing: **${songName}**`).then(async (sentMessage) => {
        const totalTime = await getSongDuration(songPath);
        if (!idleTimers[guildId]) idleTimers[guildId] = {};

        if (idleTimers[guildId]?.progressInterval) {
            clearInterval(idleTimers[guildId].progressInterval);
        }

        idleTimers[guildId].progressInterval = setInterval(() => {
            if (players[guildId].state.status === AudioPlayerStatus.Playing) {
                const currentTime = players[guildId].state.resource.playbackDuration;
                sentMessage.edit(`🎶 **${songName}**\n${formatTime(currentTime)}/${formatTime(totalTime)} [${createProgressBar(currentTime, totalTime)}]`);
            }
        }, 1000);

        players[guildId].once(AudioPlayerStatus.Idle, () => {
            clearInterval(idleTimers[guildId].progressInterval);
            sentMessage.edit(`🎶 Finished playing: **${songName}**`);
            isPlaying[guildId] = false;
            firstSongStartedMap.set(guildId, false);
            queue = getQueue(guildId);  
            if (queue.length > 0) {
                queue.shift();
                saveQueue(guildId, queue);
            }
            playNext(guildId, interaction);  
        });
    });

    if (idleTimers[guildId]) clearTimeout(idleTimers[guildId]);
}

// Pobierz kanał kolejki dla danej gildii
function getQueueChannel(guildId) {
    if (!fs.existsSync(configPath)) return null;
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    return config[guildId] || null;
}

// Wczytaj konfigurację
function loadConfig() {
    if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, JSON.stringify({}), "utf-8");
    }
    return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

// Zapisz konfigurację
function saveConfig(config) {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
}

// Rozpocznij odtwarzanie muzyki
function startPlaying(interaction) {
    const guildId = interaction.guild.id;
    if (!players[guildId] || players[guildId].state.status !== AudioPlayerStatus.Playing) {
        playNext(guildId, interaction);
    }
}

module.exports = { getQueue, saveQueue, addToQueue, clearQueue, playNext, startPlaying, getQueueChannel, saveConfig, loadConfig, shuffleQueue, isPlay, playersStop, connections, firstSongStartedMap, checkFirstSongStarted };