const path = require("path");

module.exports = {
  apps: [
    {
      name: "Eppy",
      script: "src/bot.js",
      log_date_format: "YYYY-MM-DD HH:mm Z", 
      error_file: path.join(__dirname, "logs/PM2error/error.log"),
      out_file: path.join(__dirname, "logs/PM2output/output.log"),
      pid_file: path.join(__dirname, "logs/app/app.pid"),
      merge_logs: true,
      watch: false,  
      max_memory_restart: "16000M",
      node_args: "--max-old-space-size=12288",
      autorestart: true,
      listen_timeout: 5000,  
      restart_delay: 10000,    
    }
  ]
};
