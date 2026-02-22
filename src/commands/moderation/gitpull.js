const { SlashCommandBuilder } = require("discord.js");
const { exec } = require("child_process");
const config = require("../../config");
const logger = require("../../logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("gitpull")
    .setDescription("Run git pull (tylko dla allowUsers)"),

  async execute(interaction) {
    const allowedUsers = (config.allowUsers || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (!allowedUsers.includes(interaction.user.id)) {
      return interaction.reply({
        content: "🚫 You don't have permissions",
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    exec("git pull", { cwd: process.cwd() }, async (error, stdout, stderr) => {
      if (error) {
        logger.error(`gitpull command error: ${error.message}`);
        return interaction.editReply({
          content: `❌ git pull failed:\n${error.message}`,
        });
      }

      if (stderr && stderr.trim().length > 0) {
        logger.error(`gitpull stderr: ${stderr}`);
      }

      const output = [stdout, stderr].filter(Boolean).join("\n").trim();
      const reply = output.length
        ? `✅ git pull executed:\n\n${output.slice(0, 1800)}`
        : "✅ git pull executed (no output).";

      return interaction.editReply({ content: reply });
    });
  },
};
