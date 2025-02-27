const { Routes } = require("discord-api-types/v9");
const { REST } = require("@discordjs/rest");
const logger = require("./../../logger");
const { client_ID } = process.env;
const path = require('path');
const fs = require("fs");

module.exports = (client) => {
  client.handleCommands = async () => {
    client.commandArray = [];
    const commandFolders = fs.readdirSync("./src/commands");
  
    logger.info(`📂 Znaleziono foldery komend: ${commandFolders}`);
  
    for (const folder of commandFolders) {
      const commandFiles = fs
        .readdirSync(`./src/commands/${folder}`)
        .filter((file) => file.endsWith(".js"));
      logger.info(`📁 Folder: ${folder} - znaleziono ${commandFiles.length} plików`);
  
      const { commands, commandArray } = client;
      for (const file of commandFiles) {
        const commandPath = path.join(__dirname, `../../commands/${folder}/${file}`);
        logger.debug(`🔄 Ładowanie komendy: ${commandPath}`);
        try {
          delete require.cache[require.resolve(commandPath)];
          const command = require(commandPath);
          // Sprawdź czy komenda ma poprawną strukturę
          if (!command.data || !command.data.name) {
            logger.error(`❌ Błąd: Komenda ${file} nie posiada poprawnej struktury.`);
            continue;
          }
          // Sprawdź czy komenda jest duplikatem
          if (commandArray.some(cmd => cmd.name === command.data.name)) {
            logger.error(`⚠️ Duplikat komendy: ${command.data.name} - pomijam...`);
            continue;
          }
          commands.set(command.data.name, command);
          commandArray.push(command.data);
          logger.debug(`✅ Załadowano: ${command.data.name}`);
        } catch (error) {
          logger.error(`❌ Błąd przy ładowaniu ${file}: ${error}`);
        }
      }
    }
  
    logger.info(`📜 Rejestrowane komendy: ${client.commandArray.map(cmd => cmd.name).join(", ")}`);

    const clientId = client_ID || "880185153081704528";
    const rest = new REST({ version: "9" }).setToken(process.env.token);
    try {
      logger.debug(`🚀 Aktualizowanie komend na serwerach...`);
      const guilds = client.guilds.cache;
      if (guilds.size === 0) {
        logger.error("🚫 Brak guild w cache.");
      } else {
        logger.info(`📜 Znaleziono guildy: ${guilds.size}`);
      }
    
      guilds.forEach((guild) => {
        rest.put(Routes.applicationGuildCommands(clientId, guild.id), { body: client.commandArray })
          .then(() => logger.debug(`🔄 Ładowanie komend na: ${guild.id}`))
          .catch((error) => logger.error(`❌ Błąd przy ładowaniu komend dla: ${guild.id} ${error}`));
      });
    
      logger.info(`✅ Wszystkie komendy zostały odświeżone.`);
    } catch (error) {
      logger.error(`❌ Błąd przy rejestracji komend: ${error}`);
    }
  };
  
  client.refreshCommandsAfterUse = async (interaction) => {
    await client.handleCommands();

    await interaction.reply({
      content: "✅ Komendy zostały odświeżone!",
      ephemeral: true,
    });
  };
};