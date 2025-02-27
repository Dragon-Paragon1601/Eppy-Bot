const { connection } = require("mongoose");
const fs = require("fs");

module.exports = (client) => {
  client.handleEvents = async () => {
    // Pobierz foldery z wydarzeniami
    const eventFolders = fs.readdirSync("./src/events");
    for (const folder of eventFolders) {
      // Pobierz pliki wydarzeń w danym folderze
      const eventFiles = fs
        .readdirSync(`./src/events/${folder}`)
        .filter((file) => file.endsWith(".js"));
      switch (folder) {
        case "client":
          for (const file of eventFiles) {
            const event = require(`../../events/${folder}/${file}`);
            // Jeśli wydarzenie ma być wykonane tylko raz
            if (event.once)
              client.once(event.name, (...args) =>
                event.execute(...args, client)
              );
            // Jeśli wydarzenie ma być wykonane wielokrotnie
            else
              client.on(event.name, (...args) =>
                event.execute(...args, client)
              );
          }
          break;

        case "mongo":
          for (const file of eventFiles) {
            const event = require(`../../events/${folder}/${file}`);
            // Jeśli wydarzenie MongoDB ma być wykonane tylko raz
            if (event.once)
              connection.once(event.name, (...args) =>
                event.execute(...args, client)
              );
            // Jeśli wydarzenie MongoDB ma być wykonane wielokrotnie
            else
              connection.on(event.name, (...args) =>
                event.execute(...args, client)
              );
          }
          break;

        default:
          break;
      }
    }
  };
};