const fs = require('fs');
const path = require('path');

const rouletteDataPath = path.join(__dirname, '../../../data/rouletteData.json');

let rouletteData = {};

// Wczytaj dane z pliku JSON
function loadRouletteData() {
    if (fs.existsSync(rouletteDataPath)) {
        const rawData = fs.readFileSync(rouletteDataPath);
        rouletteData = JSON.parse(rawData);
    }
}

// Zapisz dane do pliku JSON
function saveRouletteData() {
    fs.writeFileSync(rouletteDataPath, JSON.stringify(rouletteData, null, 2));
}

// Inicjalizuj dane użytkownika
function initUserData(guildId, userId) {
    if (!rouletteData[guildId]) {
        rouletteData[guildId] = {};
    }
    if (!rouletteData[guildId][userId]) {
        rouletteData[guildId][userId] = { lives: 3, currency: 0, lastPlayed: null };
    }
}

// Dodaj lub odejmij życie użytkownika
function updateLives(guildId, userId, change) {
    initUserData(guildId, userId);
    rouletteData[guildId][userId].lives += change;
    saveRouletteData();
}

// Dodaj walutę użytkownikowi
function addCurrency(guildId, userId, amount) {
    initUserData(guildId, userId);
    rouletteData[guildId][userId].currency += amount;
    saveRouletteData();
}

// Sprawdź, czy użytkownik ma życie
function hasLives(guildId, userId) {
    initUserData(guildId, userId);
    return rouletteData[guildId][userId].lives > 0;
}

// Pobierz ilość żyć i waluty użytkownika
function getUserData(guildId, userId) {
    initUserData(guildId, userId);
    return rouletteData[guildId][userId];
}

// Zresetuj życie użytkowników na nowy dzień
function resetLives() {
    const now = new Date();
    for (const guildId in rouletteData) {
        for (const userId in rouletteData[guildId]) {
            const userData = rouletteData[guildId][userId];
            const lastPlayed = new Date(userData.lastPlayed);
            if (now.getDate() !== lastPlayed.getDate()) {
                userData.lives = 3;
                userData.lastPlayed = now;
            }
        }
    }
    saveRouletteData();
}

// Pobierz ranking użytkowników na serwerze
function getTopUsers(guildId) {
    const guildData = rouletteData[guildId] || {};
    return Object.entries(guildData)
        .sort(([, a], [, b]) => b.currency - a.currency)
        .map(([userId, data]) => ({ userId, lives: data.lives, currency: data.currency }));
}

loadRouletteData();

module.exports = { updateLives, addCurrency, hasLives, resetLives, getUserData, getTopUsers };