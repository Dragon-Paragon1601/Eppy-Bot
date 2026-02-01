const fs = require("fs");
const path = require("path");
const Roulette = require("../../schemas/roulette");
const logger = require("../../logger");

// Add or remove a user's lives
async function updateLives(guildId, userId, amount) {
  let user = await Roulette.findOne({ guildId, userId });
  if (user) {
    user.lives += amount;
    if (amount === -1) {
      user.remainingBullets = 6;
      user.roundsPlayed = 0;
    }
    await user.save().catch((err) => logger.error(`Error saving user: ${err}`));
  } else {
    user = new Roulette({
      guildId,
      userId,
      lives: 3,
      currency: 0,
      lastPlayed: null,
      remainingBullets: 6,
      roundsPlayed: 0,
    });
    await user.save().catch((err) => logger.error(`Error saving user: ${err}`));
  }
}

// Add currency to a user
async function addCurrency(guildId, userId, amount) {
  let user = await Roulette.findOne({ guildId, userId });
  if (user) {
    user.currency += amount;
    await user.save().catch((err) => logger.error(`Error saving user: ${err}`));
  } else {
    user = new Roulette({
      guildId,
      userId,
      currency: amount,
      lives: 3,
      lastPlayed: null,
      remainingBullets: 6,
      roundsPlayed: 0,
    });
    await user.save().catch((err) => logger.error(`Błąd zapisu user: ${err}`));
  }
}

// Check if the user has lives
async function hasLives(guildId, userId) {
  const user = await Roulette.findOne({ guildId, userId });
  if (user) {
    return user.lives > 0;
  } else {
    const newUser = new Roulette({
      guildId,
      userId,
      lives: 3,
      currency: 0,
      lastPlayed: null,
      remainingBullets: 6,
      roundsPlayed: 0,
    });
    await newUser
      .save()
      .catch((err) => logger.error(`Error saving user: ${err}`));
    return true;
  }
}

// Get the number of lives and currency for a user
async function getUserData(guildId, userId) {
  const user = await Roulette.findOne({ guildId, userId });
  if (user) {
    return {
      lives: user.lives,
      currency: user.currency,
      lastPlayed: user.lastPlayed,
      roundsPlayed: user.roundsPlayed,
      remainingBullets: user.remainingBullets,
    };
  } else {
    const newUser = new Roulette({
      guildId,
      userId,
      lives: 3,
      currency: 0,
      lastPlayed: null,
      roundsPlayed: 0,
      remainingBullets: 6,
    });
    await newUser
      .save()
      .catch((err) => logger.error(`Error saving user: ${err}`));
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
  let user = await Roulette.findOne({ guildId, userId });
  if (!user) {
    user = new Roulette({
      guildId,
      userId,
      lives: 3,
      currency: 0,
      lastPlayed: new Date(),
    });
  } else {
    user.lastPlayed = new Date();
  }
  await user.save().catch((err) => logger.error(`Błąd zapisu user: ${err}`));
}

// Zresetuj życie użytkowników na nowy dzień
async function resetLives() {
  logger.info(`Resetting lives for all users to 3 at midnight`);

  try {
    const result = await Roulette.updateMany(
      {},
      {
        lives: 3,
        remainingBullets: 6,
        roundsPlayed: 0,
      },
    );
    logger.info(
      `Lives reset successfully. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`,
    );
  } catch (err) {
    logger.error(`resetLives error: ${err}`);
  }
}

// Pobierz ranking użytkowników na serwerze
async function getTopUsers(guildId) {
  const topUsers = await Roulette.find({ guildId })
    .sort({ currency: -1 })
    .limit(10);

  return topUsers.map((user) => ({
    userId: user.userId,
    lives: user.lives,
    currency: user.currency,
    roundsPlayed: user.roundsPlayed,
    remainingBullets: user.remainingBullets,
  }));
}

async function updateGameState(
  guildId,
  userId,
  roundsPlayed,
  remainingBullets,
) {
  try {
    const user = await Roulette.findOne({ guildId, userId });

    if (user) {
      user.roundsPlayed = roundsPlayed;
      user.remainingBullets = remainingBullets;
      await user
        .save()
        .catch((err) => logger.error(`Błąd zapisu user: ${err}`));
    } else {
      const newUser = new Roulette({
        guildId,
        userId,
        roundsPlayed,
        remainingBullets,
        lives: 3,
        currency: 0,
        lastPlayed: null,
      });
      await newUser
        .save()
        .catch((err) => logger.error(`Error saving user: ${err}`));
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
