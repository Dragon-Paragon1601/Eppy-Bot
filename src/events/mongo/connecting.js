const chalk = require("chalk");
const logger = require("../../logger");

module.exports = {
  name: "connecting",
  execute() {
    logger.debug(chalk.cyan("[Database Status]: Connecting."));
  },
};
