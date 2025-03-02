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

// Zresetuj życie użytkowników na nowy dzień
async function resetLives() {
    const now = new Date();
    const resetTime = new Date(now.setHours(0, 0, 0, 0)); // Resetuj godzinę, minutę, sekundę, milisekundę
    try {
        await Roulette.updateMany(
            { lastPlayed: { $lt: resetTime } }, 
            { lives: 3, lastPlayed: now } 
        );
        logger.info("Lives reset successfully.");
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

module.exports = { updateLives, addCurrency, hasLives, resetLives, getUserData, getTopUsers };