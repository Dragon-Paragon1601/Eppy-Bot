const fs = require('fs');
const path = require('path');
const Pet = require("../../schemas/pet"); 
const logger = require("../../logger");

// Dodaj petted dla użytkownika na serwerze
async function addPet(guildId, userId) {
    let pet = await Pet.findOne({ guildId, userId });
    if (pet) {
        pet.count += 1;
    } else {
        pet = new Pet({ guildId, userId, count: 1 });
    }
    await pet.save().catch(err => logger.error(`Błąd zapisu petData: ${err}`));
}

// Pobierz liczbę petted dla użytkownika na serwerze
async function getPetCount(guildId, userId) {
    const pet = await Pet.findOne({ guildId, userId });
    return pet ? pet.count : 0;
}

// Ustaw cooldown dla użytkownika na serwerze
async function setCooldown(guildId, userId) {
    const cooldownTime = Date.now() + 3600000;
    let pet = await Pet.findOne({ guildId, userId });
    if (pet) {
        pet.cooldown = cooldownTime;
    } else {
        pet = new Pet({ guildId, userId, cooldown: cooldownTime });
    }
    await pet.save().catch(err => logger.error(`Błąd ustawiania cooldown: ${err}`));
}

// Sprawdź czy użytkownik jest na cooldownie na serwerze
async function isOnCooldown(guildId, userId) {
    const pet = await Pet.findOne({ guildId, userId });
    if (!pet || !pet.cooldown) return false;
    const remainingTime = pet.cooldown - Date.now();
    if (remainingTime > 0) {
        return remainingTime;
    } else {
        pet.cooldown = 0;
        await pet.save();
        return false;
    }
}

// Pobierz top petted na serwerze
async function getTopPetters(guildId) {
    const topPetters = await Pet.find({ guildId }) 
        .sort({ count: -1 })
        .limit(10);
    return topPetters.map(pet => ({
        userId: pet.userId,
        count: pet.count
    }));
}

module.exports = { addPet, getPetCount, setCooldown, isOnCooldown, getTopPetters };
