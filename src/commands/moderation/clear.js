const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const logger = require("./../../logger");

const MAX_CLEAR_BATCHES = 50;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Deletes messages from the channel.")
    .addIntegerOption((option) =>
      option
        .setName("amount")
        .setDescription("Number of messages to delete (default: all)")
        .setMinValue(1)
        .setMaxValue(100),
    )
    .addStringOption((option) =>
      option
        .setName("before_message_id")
        .setDescription("Delete only messages older than this message ID")
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    const { channel, member } = interaction;
    const amount = interaction.options.getInteger("amount");
    const beforeMessageId = interaction.options.getString("before_message_id");

    const safeReply = async (payload) => {
      if (interaction.deferred) return interaction.editReply(payload);
      if (interaction.replied) return interaction.followUp(payload);
      return interaction.reply(payload);
    };

    if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return safeReply({
        content: "❌ You do not have permission to manage messages!",
        ephemeral: true,
      });
    }

    if (!channel || !channel.isTextBased?.()) {
      return safeReply({
        content: "❌ This command can only be used in a text channel.",
        ephemeral: true,
      });
    }

    if (beforeMessageId && !/^\d{17,20}$/.test(beforeMessageId)) {
      return safeReply({
        content: "❌ `before_message_id` must be a valid Discord message ID.",
        ephemeral: true,
      });
    }

    try {
      await interaction.deferReply({ ephemeral: true });
      await interaction.editReply({
        content: amount
          ? `🧹 Deleting ${amount} messages${beforeMessageId ? ` before message ${beforeMessageId}` : ""}...`
          : `🧹 Deleting all messages${beforeMessageId ? ` before message ${beforeMessageId}` : ""}...`,
      });

      if (amount) {
        const fetchOptions = { limit: amount };
        if (beforeMessageId) fetchOptions.before = beforeMessageId;

        const fetched = await channel.messages.fetch(fetchOptions);
        if (!fetched.size) {
          return interaction.editReply({
            content: "ℹ️ No messages found for the selected range.",
          });
        }

        const deleted = await channel.bulkDelete(fetched, true);
        return interaction.editReply({
          content: `✅ Deleted ${deleted.size} message(s).`,
        });
      } else {
        let deletedTotal = 0;
        let reachedOldMessages = false;
        let cursor = beforeMessageId || undefined;

        for (let batch = 0; batch < MAX_CLEAR_BATCHES; batch += 1) {
          const fetchOptions = { limit: 100 };
          if (cursor) fetchOptions.before = cursor;

          const fetched = await channel.messages.fetch(fetchOptions);
          if (!fetched.size) break;

          const deleted = await channel.bulkDelete(fetched, true);
          deletedTotal += deleted.size;

          const oldestMessage = fetched.last();
          cursor = oldestMessage?.id;

          if (deleted.size === 0) {
            reachedOldMessages = true;
            break;
          }

          if (fetched.size < 100) {
            break;
          }

          if (!cursor) {
            break;
          }
        }

        const suffix = reachedOldMessages
          ? " Some messages may be older than 14 days and cannot be bulk deleted."
          : "";

        return interaction.editReply({
          content: `✅ Deleted **${deletedTotal}** message(s).${suffix}`,
        });
      }
    } catch (error) {
      logger.error(`Error deleting messages: ${error}`);
      let errorMessage = "❌ Failed to delete messages.";
      const rawError = String(error?.message || error || "").toLowerCase();

      if (rawError.includes("14 days")) {
        errorMessage += " Make sure messages are not older than 14 days.";
      } else if (
        rawError.includes("permissions") ||
        rawError.includes("missing access") ||
        rawError.includes("missing permissions")
      ) {
        errorMessage += " Check bot permissions.";
      }

      return safeReply({
        content: errorMessage,
        ephemeral: true,
      });
    }
  },
};
