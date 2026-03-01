const chalk = require("chalk");
const logger = require("./../../logger");
const { setMongoReady } = require("../../database/state");

module.exports = {
  name: "disconnected",
  execute() {
    setMongoReady(false);
    logger.info(chalk.red("[Database Status]: Disconnected."));
  },
};
