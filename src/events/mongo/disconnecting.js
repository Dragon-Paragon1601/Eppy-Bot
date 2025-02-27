const chalk = require("chalk");
const logger = require("./../../logger");

module.exports = {
  name: "disconnected",
  execute() {
    logger.info(chalk.red("[Database Status]: Disconnected."));
  },
};
