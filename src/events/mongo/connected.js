const chalk = require("chalk");
const logger = require("./../../logger");

module.exports = {
  name: "connected",
  execute() {
    logger.info(chalk.green("[Database Status]: Connected."));
  },
};
