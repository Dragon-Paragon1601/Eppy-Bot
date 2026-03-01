const fs = require("fs");
const path = require("path");
const runtimeStore = require("../../database/runtimeStore");

// Dodaj petted dla użytkownika na serwerze
async function addPet(guildId, userId) {
  await runtimeStore.addPet(guildId, userId);
}

// Pobierz liczbę petted dla użytkownika na serwerze
async function getPetCount(guildId, userId) {
  return runtimeStore.getPetCount(guildId, userId);
}

// Ustaw cooldown dla użytkownika na serwerze
async function setCooldown(guildId, userId) {
  const cooldownTime = Date.now() + 3600000; // 1 hour cooldown
  await runtimeStore.setPetCooldown(guildId, userId, cooldownTime);
}

// Sprawdź czy użytkownik jest na cooldownie na serwerze
async function isOnCooldown(guildId, userId) {
  let pet = await runtimeStore.getPet(guildId, userId);
  if (!pet) {
    return {
      onCooldown: false,
      remainingTime: 0,
    };
  }
  const remainingTime = pet.cooldown - Date.now();
  if (remainingTime > 0) {
    return {
      onCooldown: true,
      remainingTime,
    };
  } else {
    await runtimeStore.clearPetCooldown(guildId, userId);
    return {
      onCooldown: false,
      remainingTime: 0,
    };
  }
}

// Pobierz top petted na serwerze
async function getTopPetters(guildId) {
  return runtimeStore.getTopPetters(guildId, 10);
}

module.exports = {
  addPet,
  getPetCount,
  setCooldown,
  isOnCooldown,
  getTopPetters,
};
