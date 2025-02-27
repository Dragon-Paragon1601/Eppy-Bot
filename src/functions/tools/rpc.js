const RPC = require("discord-rpc");
const config = require("../../config");
const logger = require("./../../logger");
const rpc = new RPC.Client({ transport: "ipc" });
const clientId = config.client_ID;

async function setActivity() {
    if (!rpc) return;

    rpc.setActivity({
        details: "Programming",  
        state: "Eppy Bot (1 z 1)",
        startTimestamp: Date.now(), 
        largeImageKey: "eppy", 
        largeImageText: "Eppy", 
        smallImageKey: "verified", 
        smallImageText: "Verified",
        instance: false,
    });
}

rpc.on("ready", () => {
    logger.info("✅ Rich Presence aktywne!");
    setActivity();
});

rpc.login({ clientId }).catch(err => logger.error(`Błąd z rpc clientId: ${err}`));

module.exports = { setActivity };