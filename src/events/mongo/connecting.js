const chalk = require("chalk");
const logger = require("../../logger");
const { setMongoReady } = require("../../database/state");

module.exports = {
  name: "connecting",
  execute() {
    setMongoReady(false);
    logger.debug(chalk.cyan("[Database Status]: Connecting."));
  },
};
