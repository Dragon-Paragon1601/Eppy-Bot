const path = require("path");

module.exports = {
  apps: [
    {
      name: "Eppy",
      script: "src/bot.js",

      // LOGI
      log_date_format: "YYYY-MM-DD HH:mm Z",
      error_file: path.join(__dirname, "logs/PM2error/error.log"),
      out_file: path.join(__dirname, "logs/PM2output/output.log"),
      merge_logs: true,

      // STABILNOŚĆ
      watch: ["src"],
      autorestart: false,
      listen_timeout: 5000,
      restart_delay: 5000,

      // RAM — KLUCZOWE
      max_memory_restart: "700M",
      node_args: [
        "--max-old-space-size=512",
        "--optimize_for_size",
        "--gc_interval=100",
      ].join(" "),

      // CRON (OK)
      cron_restart: "0 5 */2 * *",
    },
  ],
};
