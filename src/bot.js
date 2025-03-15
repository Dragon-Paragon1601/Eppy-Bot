const fs = require("fs");
const os = require("os");
const path = require("path");
const io = require('@pm2/io');
const logger = require("./logger");
const config = require("./config");
const pidusage = require("pidusage");
const pool = require("./events/mysql/connect");
const { connect } = require("mongoose");
const { Client, Collection, GatewayIntentBits,  } = require("discord.js");
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, // Daje dostęp do podstawowych informacji o serwerze
    GatewayIntentBits.GuildMembers, // Daje dostęp do członków serwera
    GatewayIntentBits.GuildMessages, // Daje dostęp do wiadomości na serwerze
    GatewayIntentBits.MessageContent, // Daje dostęp do treści wiadomości
    GatewayIntentBits.GuildVoiceStates // Daje dostęp do informacji o głosowych kanałach
  ]
});

client.commands = new Collection();
client.commandArray = [];

const cpuMetric = io.metric({
  name: 'CPU Usage (%)'
});
const memoryMetric = io.metric({
  name: 'Memory Usage (MB)'
});

const functionsPath = path.join(__dirname, "functions");
const functionFolders = fs.readdirSync(functionsPath);
for (const folder of functionFolders) {
  const folderPath = path.join(functionsPath, folder);
  const functionFiles = fs.readdirSync(folderPath).filter((file) => file.endsWith(".js"));

  for (const file of functionFiles) {
    const filePath = path.join(folderPath, file);
    logger.debug(`Loading: ${filePath}`);
    const moduleLoaded = require(filePath);
    
    if (typeof moduleLoaded === "function") {
      moduleLoaded(client);
    } else {
      logger.debug(`Skipping: ${file} (not a function)`);
    }
  }
}

async function monitorUsage() {
  try {
      const stats = await pidusage(process.pid);
      cpuMetric.set(stats.cpu);  
      memoryMetric.set(stats.memory / 1024 / 1024);
  } catch (error) {
      logger.error(`Błąd monitorowania zasobów: ${error}`);
  }
}

async function logUsage() {
  setInterval(async () => {
      const stats = await pidusage(process.pid);

      logger.info(`📊 Zużycie zasobów:
      🖥️ CPU: ${stats.cpu.toFixed(2)}%
      🏗️ RAM: ${(stats.memory / 1024 / 1024).toFixed(2)} MB`);
  }, 60000); 
}


client.handleEvents();
client.once('ready', async () => {
  await client.handleCommands();  
});
client.login(config.token);

logUsage();
setInterval(monitorUsage, 3000);

(async () => {
  await connect(config.databaseToken, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }).catch(console.error) ;
})();

module.exports = { client };
