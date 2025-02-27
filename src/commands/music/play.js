const { 
    addToQueue, 
    getQueue, 
    playNext, 
    getQueueChannel,
    saveQueue,
    firstSongStartedMap 
} = require("../../functions/handlers/handleMusic");
const { exec, spawn } = require("child_process");
const { SlashCommandBuilder } = require("discord.js");
const { joinVoiceChannel, getVoiceConnection } = require("@discordjs/voice");
const logger = require("./../../logger");
const path = require("path");
const fs = require("fs");
const SpotifyWebApi = require("spotify-web-api-node");
const config = require("../../config");
const spotifyApi = new SpotifyWebApi({
    clientId: config.spotify_client_ID,
    clientSecret: config.spotify_secret
});

async function getSpotifyTracks(url) {
    await spotifyApi.clientCredentialsGrant().then(data => {
        spotifyApi.setAccessToken(data.body.access_token);
    });

    let tracks = [];
    if (url.includes("track")) {
        const trackId = url.split("track/")[1].split("?")[0];
        const track = await spotifyApi.getTrack(trackId);
        tracks.push(`${track.body.name} ${track.body.artists.map(a => a.name).join(" ")}`);
    } else if (url.includes("playlist")) {
        const playlistId = url.split("playlist/")[1].split("?")[0];
        let offset = 0;
        let total = 1;
        while (offset < total) {
            const playlist = await spotifyApi.getPlaylistTracks(playlistId, { offset, limit: 50 });
            total = playlist.body.total;
            offset += playlist.body.items.length;
            tracks.push(...playlist.body.items
                .filter(item => item.track)
                .map(item => `${item.track.name} ${item.track.artists.map(a => a.name).join(" ")}`));
        }
    } else if (url.includes("album")) {
        const albumId = url.split("album/")[1].split("?")[0];
        const album = await spotifyApi.getAlbumTracks(albumId);
        tracks = album.body.items.map(track => `${track.name} ${track.artists.map(a => a.name).join(" ")}`);
    }
    return tracks;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("play")
        .setDescription("Add song to queue.")
        .addStringOption(option =>
            option.setName("find")
                .setDescription("Song name or URL")
                .setRequired(true)
        ),

        async execute(interaction) {
            const find = interaction.options.getString("find");
            const guildId = interaction.guild.id;
            const member = interaction.member;
            const voiceChannel = member.voice.channel;
        
            if (!voiceChannel) {
                return interaction.reply({
                    content: "❌ You need to be in a voice channel to play music!",
                    ephemeral: true
                });
            }
        
            await interaction.deferReply();
            const audioDir = path.join(__dirname, `../../../music/audio/${guildId}`);
        
            let firstSongStarted = firstSongStartedMap.get(guildId) || false;
        
            try {
                if (!fs.existsSync(audioDir)) {
                    fs.mkdirSync(audioDir, { recursive: true });
                    logger.debug("📁 Utworzono folder audio.");
                }
        
                if (find.includes("spotify.com")) {
                    const searchTerms = await getSpotifyTracks(find);
                    for (const term of searchTerms) {
                        await downloadAndQueue(term, interaction, voiceChannel, firstSongStarted);
                        if (!firstSongStarted) {
                            firstSongStarted = true;
                            firstSongStartedMap.set(guildId, true);  
                        }
                    }
                } else if (find.includes("list=")) {
                    exec(`yt-dlp --flat-playlist --print-json "${find}"`, async (error, stdout) => {
                        if (error) {
                            interaction.editReply({
                                content: "❌ Error fetching playlist info.",
                                ephemeral: true
                            });
                            return;
                        }
        
                        const videoUrls = stdout.split("\n").map(line => {
                            try {
                                return JSON.parse(line).url;
                            } catch {
                                return null;
                            }
                        }).filter(url => url);
        
                        if (videoUrls.length === 0) {
                            interaction.editReply({
                                content: "🚫 No playable videos found in the playlist.",
                                ephemeral: true
                            });
                            return;
                        }
        
                        interaction.editReply(`🎵 Found ${videoUrls.length} songs. Downloading one by one...`);
        
                        for (const videoUrl of videoUrls) {
                            try {
                                const success = await downloadAndQueue(videoUrl, interaction, voiceChannel, firstSongStarted);
                                if (!firstSongStarted && success) {
                                    firstSongStarted = true;
                                    firstSongStartedMap.set(guildId, true);  
                                }
                            } catch (err) {
                                logger.error(`❌ Błąd pobierania: ${videoUrl}`);
                            }
                        }
        
                        interaction.channel.send("🎶 Every song added to queue!");
                    });
                } else {
                    await downloadAndQueue(find, interaction, voiceChannel, firstSongStarted);
                    if (!firstSongStarted) {
                        firstSongStarted = true;
                        firstSongStartedMap.set(guildId, true); 
                    }
                }
            } catch (error) {
                interaction.editReply({
                    content: `❌ Error occurred: ${error.message}`,
                    ephemeral: true
                });
            }
        }
}        

async function downloadAndQueue(searchTerm, interaction, voiceChannel, firstSongStarted) {
    return new Promise((resolve) => {
        const guildId = interaction.guild.id;
        const audioDir = path.join(__dirname, `../../../music/audio/${guildId}`);
        const cookiesPath = path.join(__dirname, "../../../cookies.txt");

        if (!fs.existsSync(audioDir)) {
            fs.mkdirSync(audioDir, { recursive: true });
            logger.debug("📁 Utworzono folder audio dla serwera.");
        }

        const command = 'yt-dlp';
        const args = [
            '--restrict-filenames',
            '--default-search', 'ytsearch',
            '-f', 'bestaudio',
            '--extract-audio',
            '--audio-format', 'mp3',
            '--output', `${audioDir}/%(title)s.%(ext)s`,
            '--ignore-errors',
            '--cookies', cookiesPath, 
            searchTerm
        ];

        const process = spawn(command, args);
        let stdoutData = '';
        let stderrData = '';

        process.stdout.on('data', (data) => {
            stdoutData += data.toString();
        });

        process.stderr.on('data', (data) => {
            stderrData += data.toString();
        });

        process.on('exit', async (code) => {
            if (code !== 0) {
                logger.error(`❌ Błąd podczas pobierania: ${stderrData}`);
                resolve(false);
            } else {
                const matches = stdoutData.match(/Destination: (.+\.mp3)/g);
                if (matches) {
                    const queue = getQueue(guildId); 
                    const addedSongs = [];

                    matches.forEach(match => {
                        const filePath = match.split(": ")[1].trim();
                        if (!queue.includes(filePath)) { 
                            queue.push(filePath);
                            addedSongs.push(path.basename(filePath));
                        }
                    });

                    saveQueue(guildId, queue);

                    const textChannel = interaction.guild.channels.cache.get(getQueueChannel(guildId)) || interaction.channel;
                    if (textChannel && addedSongs.length > 0) {
                        const formattedSongs = addedSongs.map(song =>
                            song.replace(/\.mp3$/, "").replace(/_/g, " ")
                        );
                        textChannel.send(`🎵 Added to queue: \n**${formattedSongs.join(", ")}**`);
                    }

                    if (queue.length === 1 && !firstSongStarted) {
                        let connection = getVoiceConnection(guildId);

                        if (!connection) {
                            connection = joinVoiceChannel({
                                channelId: voiceChannel.id,
                                guildId: guildId,
                                adapterCreator: voiceChannel.guild.voiceAdapterCreator
                            });
                            logger.debug("🔊 Bot dołączył do kanału głosowego.");
                        } else {
                            logger.debug("✅ Bot już jest na kanale.");
                        }

                        await playNext(guildId, interaction);
                    }
                }
                resolve(true);
            }
        });
    });
}

