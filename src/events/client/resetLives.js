const cron = require('node-cron');
const { resetLives } = require('../../functions/handlers/handleRoulette');
const logger = require('../../logger');

// Schedule the resetLives function to run at midnight every day
cron.schedule('0 0 * * *', async () => {
    try {
        await resetLives();
        logger.info('Lives reset successfully.');
    } catch (error) {
        logger.error(`Error resetting lives: ${error}`);
    }
});