const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require("discord.js");

const pages = () => {
  const intro = new EmbedBuilder()
    .setTitle("Eppy-Bot")
    .setColor(0x00cc99)
    .setDescription(
      "**About**\nEppy-Bot — a lightweight music and moderation assistant for Discord.\n\n" +
        "**Creator**: Dragon-Paragon1601\n" +
        "**Source / Issues**: https://github.com/Dragon-Paragon1601/Eppy-Bot/issues\n" +
        "**Support & Contact**: open an issue on the repository for feature requests or bug reports.\n\n" +
        "Use the categories below to browse and read detailed command docs.",
    );

  const music = new EmbedBuilder()
    .setTitle("Music Commands — details")
    .setColor(0x1db954)
    .setDescription(
      "**/play <track> [playlist]**\nDescription: Play a track or set the active playlist.\nBehavior:\n" +
        "- If nothing is playing, the provided track starts immediately.\n" +
        "- If something is playing, the provided track is added to the *priority queue* (FIFO) and will play after the current track finishes.\n\n" +
        "**/queue <action> [options]** — Detailed usage:\n" +
        "- `queue` — show the current queue (first 25 entries). Priority items are marked with ⭐ next to the item.\n" +
        "- `auto [value:boolean] [random:boolean]` — enable/disable auto-play; `random:true` will randomly shuffle selection. Example: `/queue auto value:true random:true`.\n" +
        "- `clear` — clear main queue and remove cached audio files. Example: `/queue clear`.\n" +
        "- `resume` — unpause playback if paused; if stopped and queue exists, starts playback. Example: `/queue resume`.\n" +
        "- `pause` — pause current playback. Example: `/queue pause`.\n" +
        "- `next` — skip current track to next (priority considered). Example: `/queue next`.\n" +
        "- `shuffle` — shuffle the main queue (priority queue is not shuffled). Example: `/queue shuffle`.\n" +
        "- `previous` — play the previous track from history (if available). Example: `/queue previous`.\n" +
        "- `stop` — stop playback and disconnect bot from voice. Example: `/queue stop`.\n\n" +
        "Priority queue behavior:\n" +
        "- Priority queue holds tracks added while something is playing.\n" +
        "- It is FIFO: items play in the order they were added.\n" +
        "- After the current track ends, the bot will play all priority items before resuming the main queue.\n" +
        "- Priority queue is in-memory and will be lost if the bot restarts.",
    );

  const moderation = new EmbedBuilder()
    .setTitle("Moderation Commands — details")
    .setColor(0xff6b6b)
    .setDescription(
      "**/ban <target> [time] [reason]**\n" +
        "- Description: Ban a member from the server. Requires `Ban Members` permission.\n" +
        "- Options: `target` (user, required), `time` (integer days 1–7 to delete messages), `reason` (optional).\n" +
        "- Notes: The bot will attempt to DM the user before banning. If you lack permission or the bot lacks ban power, the action will fail. Example: `/ban target:@user time:2 reason:spamming`.\n\n" +
        "**/kick <target> [reason]**\n" +
        "- Description: Kick a member from the server. Requires `Kick Members` permission.\n" +
        "- Options: `target` (user, required), `reason` (optional). Example: `/kick target:@user reason:rule violation`.\n\n" +
        "**/clear [amount]**\n" +
        "- Description: Bulk-delete messages in the current channel. Requires `Manage Messages`.\n" +
        "- Options: `amount` (integer 1–100). If omitted, deletes messages in batches until channel is cleared.\n" +
        "- Notes: Discord prevents bulk-deleting messages older than 14 days; the command will report that in errors. Example: `/clear amount:50`.\n\n" +
        "**/restart**\n" +
        "- Description: Restart the bot process. Restricted to repository `allowUsers` (configured via env).\n" +
        "- Notes: Executes `pm2 restart Eppy` in the configured environment. Use only when necessary. Example: `/restart` (admin/allowlist only).\n\n" +
        "**/settings**\n" +
        "- Description: Configure server channels and mappings (Admin or allowlisted users).\n" +
        "- Options: `queue_channel`, `notification_channel`, `welcome_channel` (text channels) or boolean clears: `clear_queue_channel`, `clear_notification_channel`, `clear_welcome_channel`.\n" +
        "- Notes: If called without options, the command replies with current mappings for the server. Example: `/settings queue_channel:#music notification_channel:#announcements`.",
    );

  const tools = new EmbedBuilder()
    .setTitle("Tools & Utility")
    .setColor(0x7289da)
    .setDescription(
      "**/ping** — latency check.\n**/refresh** — refresh internal state.\n**/help** — show this interactive help.",
    );

  const misc = new EmbedBuilder()
    .setTitle("Misc Commands")
    .setColor(0x00a8ff)
    .setDescription(
      "**/pet <action>**\n" +
        "- `pet` — Pet the bot. Updates bot presence with your name and records the pet; a per-user cooldown prevents spamming. Example: `/pet action:pet`.\n" +
        "- `ranking` — Show top petters in this server. Example: `/pet action:ranking`.\n\n" +
        "**/roulette <action>**\n" +
        "- `shoot` — Pull the trigger once. You may win or lose a life; rounds and remaining bullets are tracked. Example: `/roulette action:shoot`.\n" +
        "- `roll` — Spin the cylinder without shooting; preserves game state and bullet count. Example: `/roulette action:roll`.\n" +
        "- `quit` — Quit the current game and claim earned coins; resets bullets and rounds. Example: `/roulette action:quit`.\n" +
        "- `lives` — Show your current lives and coins. Example: `/roulette action:lives`.\n" +
        "- `rank` — Show leaderboard for roulette (top users by lives/coins). Example: `/roulette action:rank`.",
    );

  return [intro, music, moderation, tools, misc];
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show interactive help for bot commands"),

  async execute(interaction) {
    const categoryEmbeds = pages();
    const authorId = interaction.user.id;

    const navRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("prev")
        .setLabel("◀️ Prev")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("next")
        .setLabel("Next ▶️")
        .setStyle(ButtonStyle.Primary),
    );

    const selectRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("help_select")
        .setPlaceholder("Jump to category")
        .addOptions(
          { label: "Intro", value: "0" },
          { label: "Music", value: "1" },
          { label: "Moderation", value: "2" },
          { label: "Tools", value: "3" },
          { label: "Misc", value: "4" },
        ),
    );

    let page = 0;

    const msg = await interaction.reply({
      embeds: [categoryEmbeds[page]],
      components: [navRow, selectRow],
      fetchReply: true,
    });

    const collector = msg.createMessageComponentCollector({ time: 120000 });

    collector.on("collect", async (i) => {
      try {
        if (i.user.id !== authorId) {
          await i.reply({
            content: "Only the command user can control this help message.",
            ephemeral: true,
          });
          return;
        }

        if (i.isStringSelectMenu && i.customId === "help_select") {
          const choice = parseInt(i.values[0], 10);
          page = isNaN(choice)
            ? 0
            : Math.max(0, Math.min(choice, categoryEmbeds.length - 1));
          await i.update({
            embeds: [categoryEmbeds[page]],
            components: [navRow, selectRow],
          });
          return;
        }

        if (i.isButton()) {
          if (i.customId === "next") {
            page = (page + 1) % categoryEmbeds.length;
            await i.update({
              embeds: [categoryEmbeds[page]],
              components: [navRow, selectRow],
            });
            return;
          }
          if (i.customId === "prev") {
            page = (page - 1 + categoryEmbeds.length) % categoryEmbeds.length;
            await i.update({
              embeds: [categoryEmbeds[page]],
              components: [navRow, selectRow],
            });
            return;
          }
        }
      } catch (err) {
        console.error("Help collector error:", err);
      }
    });

    collector.on("end", async () => {
      try {
        const disabledNav = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("prev")
            .setLabel("◀️ Prev")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId("next")
            .setLabel("Next ▶️")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true),
        );
        const disabledSelect = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("help_select")
            .setPlaceholder("Expired")
            .setDisabled(true),
        );
        await msg.edit({ components: [disabledNav, disabledSelect] });
      } catch (e) {
        /* ignore edit errors */
      }
    });
  },
};
