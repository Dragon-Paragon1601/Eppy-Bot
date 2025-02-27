const chalk = require("chalk");
const logger = require("./../../logger");

module.exports = {
  name: "err",
  execute(err) {
    logger.error(
      chalk.red(`An error occured with the database connection:\n${err}`)
    );
  },
};
