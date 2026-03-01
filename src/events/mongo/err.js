const chalk = require("chalk");
const logger = require("./../../logger");
const { setMongoReady } = require("../../database/state");

module.exports = {
  name: "err",
  execute(err) {
    setMongoReady(false);
    logger.error(
      chalk.red(`An error occured with the database connection:\n${err}`),
    );
  },
};
