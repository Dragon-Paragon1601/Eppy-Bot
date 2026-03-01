const chalk = require("chalk");
const logger = require("./../../logger");
const { setMongoReady } = require("../../database/state");

module.exports = {
  name: "connected",
  execute() {
    setMongoReady(true);
    logger.info(chalk.green("[Database Status]: Connected."));
  },
};
