const fs = require('fs');
const path = require('path');
const Roulette = require("../../schemas/roulette"); 
const logger = require("../../logger");

// Dodaj lub odejmij życie użytkownika
async function updateLives(guildId, userId, amount) {
    let user = await Roulette.findOne({ guildId, userId });
    if (user) {
        user.lives += amount;
        await user.save().catch(err => logger.error(`Błąd zapisu user: ${err}`));
    } else {
        user = new Roulette({ guildId, userId, lives: 3, currency: 0, lastPlayed: null });
        await user.save().catch(err => logger.error(`Błąd zapisu user: ${err}`));
    }
}

// Dodaj walutę użytkownikowi
async function addCurrency(guildId, userId, amount) {
    let user = await Roulette.findOne({ guildId, userId });
    if (user) {
        user.currency += amount;
        await user.save().catch(err => logger.error(`Błąd zapisu user: ${err}`));
    } else {
        user = new Roulette({ guildId, userId, currency: amount, lives: 3, lastPlayed: null });
        await user.save().catch(err => logger.error(`Błąd zapisu user: ${err}`));
    }
}

// Sprawdź czy użytkownik ma życie
async function hasLives(guildId, userId) {
    const user = await Roulette.findOne({ guildId, userId }).lean();
    return user ? user.lives > 0 : false;
}

// Pobierz ilość żyć i waluty użytkownika
async function getUserData(guildId, userId) {
    const user = await Roulette.findOne({ guildId, userId }).lean();
    return user || { lives: 3, currency: 0, lastPlayed: null };
}

async function handleUserAction(guildId, userId) {
    let user = await Roulette.findOne({ guildId, userId });
    if (!user) {
        user = new Roulette({ guildId, userId, lives: 3, currency: 0, lastPlayed: new Date() });
    } else {
        user.lastPlayed = new Date();
    }
    await user.save().catch(err => logger.error(`Błąd zapisu user: ${err}`));
}

// Zresetuj życie użytkowników na nowy dzień
async function resetLives() {
    logger.info(`Resetting lives for all users to 3 at midnight`);

    try {
        const result = await Roulette.updateMany(
            {}, // No filter, update all users
            { lives: 3 }
        );
        logger.info(`Lives reset successfully. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);
    } catch (err) {
        logger.error(`Błąd resetLives: ${err}`);
    }
}

// Pobierz ranking użytkowników na serwerze
async function getTopUsers(guildId) {
    const topUsers = await Roulette.find({ guildId })
        .sort({ currency: -1 })
        .limit(10)
        .lean();

    return topUsers.map(user => ({
        userId: user.userId,
        lives: user.lives,
        currency: user.currency,
    }));
}

module.exports = { updateLives, addCurrency, hasLives, resetLives, getUserData, getTopUsers, handleUserAction };