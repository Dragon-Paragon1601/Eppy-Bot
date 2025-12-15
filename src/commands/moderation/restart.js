const { SlashCommandBuilder } = require("discord.js");
const { exec } = require("child_process");
const logger = require("./../../logger");
const config = require("./../../config");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("restart")
        .setDescription("Restart bot (tylko dla administratorów)"),

    async execute(interaction) {
        const allowedUsers = config.allowUsers;

        if (!allowedUsers.includes(interaction.user.id)) {
            return interaction.reply({
                content: "🚫 You don't have permissions",
                ephemeral: true,
            });
        }

        await interaction.reply("🔄 Restarting bot...");
        
        setTimeout(() => {
            exec("pm2 restart Eppy-Bot", (error, stdout, stderr) => {
                if (error) {
                    logger.error(`❌ Błąd restartu: ${error.message}`);
                    return;
                }
                if (stderr) {
                    logger.error(`❌ Błąd stderr: ${stderr}`);
                    return;
                }
                logger.info(`✅ Restart wykonany: ${stdout}`);
            });
        }, 2000);

        // exec('cmd /c start restart.bat', (error) => {
        //     if (error) {
        //         console.error(`Błąd przy uruchamianiu restart.bat: ${error}`);
        //     }
        //     process.exit();
        // });
    }
};
