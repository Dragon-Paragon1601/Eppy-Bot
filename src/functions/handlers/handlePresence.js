const fs = require('fs');
const path = require('path');

const petDataPath = path.join(__dirname, '../../../data/petData.json');

let petData = {};

// Wczytaj dane z pliku JSON
function loadPetData() {
    if (fs.existsSync(petDataPath)) {
        const rawData = fs.readFileSync(petDataPath);
        petData = JSON.parse(rawData);
    }
    if (!petData.cooldowns) {
        petData.cooldowns = {};
    }
}

// Zapisz dane do pliku JSON
function savePetData() {
    fs.writeFileSync(petDataPath, JSON.stringify(petData, null, 2));
}

// Dodaj petted dla użytkownika na serwerze
function addPet(guildId, userId) {
    if (!petData[guildId]) {
        petData[guildId] = {};
    }
    if (!petData[guildId][userId]) {
        petData[guildId][userId] = 0;
    }
    petData[guildId][userId] += 1;
    savePetData();
}

// Pobierz liczbę petted dla użytkownika na serwerze
function getPetCount(guildId, userId) {
    return petData[guildId]?.[userId] || 0;
}

// Ustaw cooldown dla użytkownika
function setCooldown(userId) {
    petData.cooldowns[userId] = Date.now() + 3600000; 
    savePetData();
}

// Sprawdź czy użytkownik jest na cooldownie
function isOnCooldown(userId) {
    const cooldown = petData.cooldowns?.[userId];
    if (!cooldown) return false;
    const remainingTime = cooldown - Date.now();
    if (remainingTime > 0) {
        return remainingTime;
    } else {
        delete petData.cooldowns[userId];
        savePetData();
        return false;
    }
}

// Pobierz top petted na serwerze
function getTopPetters(guildId) {
    const guildPetData = petData[guildId] || {};
    return Object.entries(guildPetData)
        .sort(([, a], [, b]) => b - a)
        .map(([userId, count]) => ({ userId, count }));
}

loadPetData();

module.exports = { addPet, getPetCount, setCooldown, isOnCooldown, getTopPetters };