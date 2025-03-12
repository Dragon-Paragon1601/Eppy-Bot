const { updateLives, addCurrency, hasLives, getUserData, getTopUsers, updateGameState } = require("../../functions/handlers/handleRoulette");
const { SlashCommandBuilder } = require("discord.js");
const config = require("../../config");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("roulette")
        .setDescription("Play a game of russian roulette (6-1).")
        .addStringOption(option =>
            option.setName("action")
                .setDescription("Choose an action")
                .setRequired(true)
                .addChoices(
                    { name: "shoot", value: "shoot" },
                    { name: "roll", value: "roll" },
                    { name: "quit", value: "quit" },
                    { name: "lives", value: "lives" },
                    { name: "rank", value: "rank" }
                )),
    async execute(interaction) {
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;
        const action = interaction.options.getString("action");

        if (action === "lives") {
            const { lives, currency } = await getUserData(guildId, userId);
            return interaction.reply({
                content: `Your \nLives: **${lives}** ❤️ \nCoins: **${currency}** 🪙.`,
                ephemeral: true,
            });
        }

        if (action === "rank") {
            const topUsers = await getTopUsers(guildId);
            const rankList = topUsers.map((user, index) => `${index + 1}. <@${user.userId}> **${user.lives}** ❤️ with **${user.currency}** 🪙`).join("\n");
            return interaction.reply({
                content: `🏆 **Top Users** 🏆\n${rankList}`,
            });
        }

        const isAllowedUser = config.allowUsers.includes(userId);
        if (!isAllowedUser) {
            const hasLivesLeft = await hasLives(guildId, userId);
            if (!hasLivesLeft) {
                return interaction.reply({
                    content: "🚫 You have no lives left. Please wait until tomorrow to play again.",
                    ephemeral: true,
                });
            }
        }

        let { roundsPlayed, remainingBullets } = await getUserData(guildId, userId); 
        let result;
        let coinsWon = 0;

        let outcomes = ["💥 You lost!", "🎉 You won!", "🎉 You won!", "🎉 You won!", "🎉 You won!", "🎉 You won!"];

        if (action === "quit") {
            coinsWon = calculateCoins(roundsPlayed);
            ammount = coinsWon;
            await addCurrency(guildId, userId, ammount);

            remainingBullets = 6;
            roundsPlayed = 0;
            await updateGameState(guildId, userId, roundsPlayed, remainingBullets); 
            return interaction.reply({
                content: `Game reset. You quit the game. You earned **${coinsWon}** 🪙 coins. Starting a new game...`,
                ephemeral: true,
            });
        }

        if (action === "shoot") {
            if (remainingBullets > 0) {
                result = outcomes[Math.floor(Math.random() * outcomes.length)];
                roundsPlayed++;
                remainingBullets--; 

                if (result === "🎉 You won!") {

                    const index = outcomes.indexOf("🎉 You won!");
                    if (index !== -1) {
                        outcomes.splice(index, 1);
                    }
                    result = `🎉 You won! \nThere are **${remainingBullets}** bullets left.`;
                } else {
                    const { lives } = await getUserData(guildId, userId);
                    if (lives > 0) {
                        await updateLives(guildId, userId, -1);
                        result = "💥 You lost! Game over!";
                    } else {
                        result = "💥 You lost! Game over! You have no lives left.";
                        remainingBullets = 6;
                        roundsPlayed = 0;
        
                        await updateGameState(guildId, userId, roundsPlayed, remainingBullets); 
                    }
                }
            } else {
                result = `🔫 You have no more bullets left!`;
            }

            if (roundsPlayed >= 6) {
                result = "🎉 You won the whole bid! (Always lost after 6 rounds)";
                coinsWon = calculateCoins(roundsPlayed);
                ammount = coinsWon;
                await addCurrency(guildId, userId, ammount);

                remainingBullets = 6;
                roundsPlayed = 0;
            }

            await updateGameState(guildId, userId, roundsPlayed, remainingBullets);
        } else if (action === "roll") {
            result = `🔄 You rolled the cylinder. \nThe game continues. \nThere are **${remainingBullets}** bullets left.`;
        }

        await interaction.reply({
            content: result,
            ephemeral: true,    
        });
    },
};

// Funkcja do obliczania monet w zależności od liczby rozegranych rund
function calculateCoins(roundsPlayed) {
    switch (roundsPlayed) {
        case 1:
            return 0;
        case 2:
            return 1;
        case 3:
            return 2;
        case 4:
            return 3;
        case 5:
            return 6;
        default:
            return 0; 
    }
}
