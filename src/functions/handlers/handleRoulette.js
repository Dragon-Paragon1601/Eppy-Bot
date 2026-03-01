const fs = require("fs");
const path = require("path");
const runtimeStore = require("../../database/runtimeStore");
const logger = require("../../logger");

// Add or remove a user's lives
async function updateLives(guildId, userId, amount) {
  let user = await runtimeStore.getRouletteUser(guildId, userId);
  if (user) {
    user.lives += amount;
    if (amount === -1) {
      user.remainingBullets = 6;
      user.roundsPlayed = 0;
    }
    await runtimeStore.saveRouletteUser(user);
  } else {
    user = {
      guildId,
      userId,
      lives: 3,
      currency: 0,
      lastPlayed: null,
      remainingBullets: 6,
      roundsPlayed: 0,
    };
    await runtimeStore.saveRouletteUser(user);
  }
}

// Add currency to a user
async function addCurrency(guildId, userId, amount) {
  let user = await runtimeStore.getRouletteUser(guildId, userId);
  if (user) {
    user.currency += amount;
    await runtimeStore.saveRouletteUser(user);
  } else {
    user = {
      guildId,
      userId,
      currency: amount,
      lives: 3,
      lastPlayed: null,
      remainingBullets: 6,
      roundsPlayed: 0,
    };
    await runtimeStore.saveRouletteUser(user);
  }
}

// Check if the user has lives
async function hasLives(guildId, userId) {
  const user = await runtimeStore.getRouletteUser(guildId, userId);
  if (user) {
    return user.lives > 0;
  } else {
    const newUser = {
      guildId,
      userId,
      lives: 3,
      currency: 0,
      lastPlayed: null,
      remainingBullets: 6,
      roundsPlayed: 0,
    };
    await runtimeStore.saveRouletteUser(newUser);
    return true;
  }
}

// Get the number of lives and currency for a user
async function getUserData(guildId, userId) {
  const user = await runtimeStore.getRouletteUser(guildId, userId);
  if (user) {
    return {
      lives: user.lives,
      currency: user.currency,
      lastPlayed: user.lastPlayed,
      roundsPlayed: user.roundsPlayed,
      remainingBullets: user.remainingBullets,
    };
  } else {
    const newUser = {
      guildId,
      userId,
      lives: 3,
      currency: 0,
      lastPlayed: null,
      roundsPlayed: 0,
      remainingBullets: 6,
    };
    await runtimeStore.saveRouletteUser(newUser);
    return {
      lives: 3,
      currency: 0,
      lastPlayed: null,
      roundsPlayed: 0,
      remainingBullets: 6,
    };
  }
}

async function handleUserAction(guildId, userId) {
  let user = await runtimeStore.getRouletteUser(guildId, userId);
  if (!user) {
    user = {
      guildId,
      userId,
      lives: 3,
      currency: 0,
      lastPlayed: new Date(),
      roundsPlayed: 0,
      remainingBullets: 6,
    };
  } else {
    user.lastPlayed = new Date();
  }
  await runtimeStore.saveRouletteUser(user);
}

// Zresetuj życie użytkowników na nowy dzień
async function resetLives() {
  logger.info(`Resetting lives for all users to 3 at midnight`);

  try {
    const result = await runtimeStore.resetRouletteLives();
    logger.info(
      `Lives reset successfully. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`,
    );
  } catch (err) {
    logger.error(`resetLives error: ${err}`);
  }
}

// Pobierz ranking użytkowników na serwerze
async function getTopUsers(guildId) {
  return runtimeStore.getTopRouletteUsers(guildId, 10);
}

async function updateGameState(
  guildId,
  userId,
  roundsPlayed,
  remainingBullets,
) {
  try {
    const user = await runtimeStore.getRouletteUser(guildId, userId);

    if (user) {
      user.roundsPlayed = roundsPlayed;
      user.remainingBullets = remainingBullets;
      await runtimeStore.saveRouletteUser(user);
    } else {
      const newUser = {
        guildId,
        userId,
        roundsPlayed,
        remainingBullets,
        lives: 3,
        currency: 0,
        lastPlayed: null,
      };
      await runtimeStore.saveRouletteUser(newUser);
    }
  } catch (err) {
    logger.error(`Error in updateGameState: ${err}`);
  }
}

module.exports = {
  updateLives,
  addCurrency,
  hasLives,
  resetLives,
  getUserData,
  getTopUsers,
  handleUserAction,
  updateGameState,
};
