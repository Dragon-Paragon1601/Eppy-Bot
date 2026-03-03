const fs = require("fs");
const os = require("os");
const path = require("path");
const io = require("@pm2/io");
const logger = require("./logger");
const config = require("./config");
const pidusage = require("pidusage");
const pool = require("./events/mysql/connect");
const { shutdownMusicBridge } = require("./functions/tools/musicBridge");
const { connect } = require("mongoose");
const {
  setMongoConfigured,
  setMongoReady,
  setMySqlConfigured,
  setMySqlReady,
} = require("./database/state");
const { Client, Collection, GatewayIntentBits } = require("discord.js");
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, // Daje dostęp do podstawowych informacji o serwerze
    GatewayIntentBits.GuildMembers, // Daje dostęp do członków serwera
    GatewayIntentBits.GuildMessages, // Daje dostęp do wiadomości na serwerze
    GatewayIntentBits.MessageContent, // Daje dostęp do treści wiadomości
    GatewayIntentBits.GuildVoiceStates, // Daje dostęp do informacji o głosowych kanałach
  ],
});

client.commands = new Collection();
client.commandArray = [];

const cpuMetric = io.metric({
  name: "CPU Usage (%)",
});
const memoryMetric = io.metric({
  name: "Memory Usage (MB)",
});

const functionsPath = path.join(__dirname, "functions");
const functionFolders = fs.readdirSync(functionsPath);
for (const folder of functionFolders) {
  const folderPath = path.join(functionsPath, folder);
  const functionFiles = fs
    .readdirSync(folderPath)
    .filter((file) => file.endsWith(".js"));

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

//async function logUsage() {
//  setInterval(async () => {
//    const stats = await pidusage(process.pid);
//
//    logger.info(`📊 Zużycie zasobów:
//      🖥️ CPU: ${stats.cpu.toFixed(2)}%
//      🏗️ RAM: ${(stats.memory / 1024 / 1024).toFixed(2)} MB`);
//  }, 60000);
//}

client.handleEvents();
client.once("clientReady", async () => {
  await client.handleCommands();
});
client.login(config.token);

//logUsage();
setInterval(monitorUsage, 18000);

let isShuttingDown = false;

async function gracefulShutdown(reason = "shutdown") {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.warn(`Graceful shutdown started: ${reason}`);

  try {
    await shutdownMusicBridge(client);
  } catch (error) {
    logger.error(`shutdownMusicBridge error: ${error}`);
  }

  try {
    if (client && typeof client.destroy === "function") {
      client.destroy();
    }
  } catch (error) {
    logger.error(`Discord client destroy error: ${error}`);
  }

  process.exit(0);
}

process.on("SIGINT", () => {
  gracefulShutdown("SIGINT");
});

process.on("SIGTERM", () => {
  gracefulShutdown("SIGTERM");
});

process.on("uncaughtException", (error) => {
  logger.error(`uncaughtException: ${error}`);
  gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason) => {
  logger.error(`unhandledRejection: ${reason}`);
  gracefulShutdown("unhandledRejection");
});

(async () => {
  const mongoConfigured = !!(config.databaseToken || "").trim();
  setMongoConfigured(mongoConfigured);

  if (!mongoConfigured) {
    logger.warn("MongoDB token not configured. Running in in-memory mode.");
    setMongoReady(false);
  } else {
    await connect(config.databaseToken)
      .then(() => setMongoReady(true))
      .catch((err) => {
        logger.error(
          `Mongo connection failed. Switching to in-memory mode: ${err}`,
        );
        setMongoReady(false);
      });
  }

  const mysqlConfigured = !!(
    (config.DB_HOST || "").trim() &&
    (config.DB_USER || "").trim() &&
    (config.DB_NAME || "").trim()
  );
  setMySqlConfigured(mysqlConfigured);
  setMySqlReady(
    typeof pool.isAvailable === "function" ? pool.isAvailable() : false,
  );
})();

module.exports = { client };
