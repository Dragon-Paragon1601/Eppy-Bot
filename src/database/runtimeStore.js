const Queue = require("../schemas/queue");
const Pet = require("../schemas/pet");
const Roulette = require("../schemas/roulette");
const MusicPlayStat = require("../schemas/musicPlayStat");
const logger = require("../logger");
const { isMongoAvailable, setMongoReady } = require("./state");

const memory = {
  queues: new Map(),
  pets: new Map(),
  roulette: new Map(),
  musicStats: new Map(),
};

function key(guildId, userId) {
  return `${guildId}:${userId}`;
}

function touchMongoError(context, err) {
  logger.error(`${context}: ${err}`);
  setMongoReady(false);
}

async function getQueue(guildId) {
  if (isMongoAvailable()) {
    try {
      let queueDoc = await Queue.findOne({ guildId });
      if (!queueDoc) {
        queueDoc = new Queue({ guildId, songs: [] });
        await queueDoc.save();
      }
      return Array.isArray(queueDoc.songs) ? queueDoc.songs : [];
    } catch (err) {
      touchMongoError("getQueue mongo error", err);
    }
  }

  if (!memory.queues.has(guildId)) memory.queues.set(guildId, []);
  return memory.queues.get(guildId);
}

async function saveQueue(guildId, songs) {
  const safeSongs = Array.isArray(songs) ? songs.slice() : [];

  if (isMongoAvailable()) {
    try {
      let queueDoc = await Queue.findOne({ guildId });
      if (!queueDoc) {
        queueDoc = new Queue({ guildId, songs: safeSongs });
      } else {
        queueDoc.songs = safeSongs;
      }
      await queueDoc.save();
      return;
    } catch (err) {
      touchMongoError("saveQueue mongo error", err);
    }
  }

  memory.queues.set(guildId, safeSongs);
}

async function getAllQueues() {
  if (isMongoAvailable()) {
    try {
      return await Queue.find({}).lean();
    } catch (err) {
      touchMongoError("getAllQueues mongo error", err);
    }
  }

  return Array.from(memory.queues.entries()).map(([guildId, songs]) => ({
    guildId,
    songs: Array.isArray(songs) ? songs.slice() : [],
  }));
}

function getOrCreatePet(guildId, userId) {
  const k = key(guildId, userId);
  let pet = memory.pets.get(k);
  if (!pet) {
    pet = { guildId, userId, count: 0, cooldown: 0 };
    memory.pets.set(k, pet);
  }
  return pet;
}

async function addPet(guildId, userId) {
  if (isMongoAvailable()) {
    try {
      let pet = await Pet.findOne({ guildId, userId });
      if (!pet) {
        pet = new Pet({ guildId, userId, count: 1, cooldown: 0 });
      } else {
        pet.count += 1;
      }
      await pet.save();
      return;
    } catch (err) {
      touchMongoError("addPet mongo error", err);
    }
  }

  const pet = getOrCreatePet(guildId, userId);
  pet.count += 1;
}

async function getPetCount(guildId, userId) {
  if (isMongoAvailable()) {
    try {
      const pet = await Pet.findOne({ guildId, userId });
      return pet ? pet.count : 0;
    } catch (err) {
      touchMongoError("getPetCount mongo error", err);
    }
  }

  return getOrCreatePet(guildId, userId).count;
}

async function setPetCooldown(guildId, userId, cooldown) {
  if (isMongoAvailable()) {
    try {
      let pet = await Pet.findOne({ guildId, userId });
      if (!pet) {
        pet = new Pet({ guildId, userId, count: 0, cooldown });
      } else {
        pet.cooldown = cooldown;
      }
      await pet.save();
      return;
    } catch (err) {
      touchMongoError("setPetCooldown mongo error", err);
    }
  }

  const pet = getOrCreatePet(guildId, userId);
  pet.cooldown = cooldown;
}

async function clearPetCooldown(guildId, userId) {
  return setPetCooldown(guildId, userId, 0);
}

async function getPet(guildId, userId) {
  if (isMongoAvailable()) {
    try {
      const pet = await Pet.findOne({ guildId, userId });
      return pet
        ? {
            guildId: pet.guildId,
            userId: pet.userId,
            count: pet.count,
            cooldown: pet.cooldown,
          }
        : null;
    } catch (err) {
      touchMongoError("getPet mongo error", err);
    }
  }

  const k = key(guildId, userId);
  return memory.pets.get(k) || null;
}

async function getTopPetters(guildId, limit = 10) {
  if (isMongoAvailable()) {
    try {
      const top = await Pet.find({ guildId })
        .sort({ count: -1 })
        .limit(limit)
        .lean();
      return top.map((row) => ({ userId: row.userId, count: row.count }));
    } catch (err) {
      touchMongoError("getTopPetters mongo error", err);
    }
  }

  return Array.from(memory.pets.values())
    .filter((p) => p.guildId === guildId)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((p) => ({ userId: p.userId, count: p.count }));
}

function getOrCreateRoulette(guildId, userId) {
  const k = key(guildId, userId);
  let user = memory.roulette.get(k);
  if (!user) {
    user = {
      guildId,
      userId,
      lives: 3,
      currency: 0,
      lastPlayed: null,
      roundsPlayed: 0,
      remainingBullets: 6,
    };
    memory.roulette.set(k, user);
  }
  return user;
}

async function getRouletteUser(guildId, userId) {
  if (isMongoAvailable()) {
    try {
      const user = await Roulette.findOne({ guildId, userId });
      return user
        ? {
            guildId: user.guildId,
            userId: user.userId,
            lives: user.lives,
            currency: user.currency,
            lastPlayed: user.lastPlayed,
            roundsPlayed: user.roundsPlayed,
            remainingBullets: user.remainingBullets,
          }
        : null;
    } catch (err) {
      touchMongoError("getRouletteUser mongo error", err);
    }
  }

  const k = key(guildId, userId);
  return memory.roulette.get(k) || null;
}

async function saveRouletteUser(userData) {
  const base = {
    guildId: userData.guildId,
    userId: userData.userId,
    lives: userData.lives ?? 3,
    currency: userData.currency ?? 0,
    lastPlayed: userData.lastPlayed ?? null,
    roundsPlayed: userData.roundsPlayed ?? 0,
    remainingBullets: userData.remainingBullets ?? 6,
  };

  if (isMongoAvailable()) {
    try {
      let user = await Roulette.findOne({
        guildId: base.guildId,
        userId: base.userId,
      });
      if (!user) {
        user = new Roulette(base);
      } else {
        Object.assign(user, base);
      }
      await user.save();
      return;
    } catch (err) {
      touchMongoError("saveRouletteUser mongo error", err);
    }
  }

  memory.roulette.set(key(base.guildId, base.userId), base);
}

async function resetRouletteLives() {
  if (isMongoAvailable()) {
    try {
      return await Roulette.updateMany(
        {},
        { lives: 3, remainingBullets: 6, roundsPlayed: 0 },
      );
    } catch (err) {
      touchMongoError("resetRouletteLives mongo error", err);
    }
  }

  let modifiedCount = 0;
  for (const [mapKey, user] of memory.roulette.entries()) {
    memory.roulette.set(mapKey, {
      ...user,
      lives: 3,
      remainingBullets: 6,
      roundsPlayed: 0,
    });
    modifiedCount += 1;
  }

  return { matchedCount: modifiedCount, modifiedCount };
}

async function getTopRouletteUsers(guildId, limit = 10) {
  if (isMongoAvailable()) {
    try {
      const top = await Roulette.find({ guildId })
        .sort({ currency: -1 })
        .limit(limit)
        .lean();
      return top.map((user) => ({
        userId: user.userId,
        lives: user.lives,
        currency: user.currency,
        roundsPlayed: user.roundsPlayed,
        remainingBullets: user.remainingBullets,
      }));
    } catch (err) {
      touchMongoError("getTopRouletteUsers mongo error", err);
    }
  }

  return Array.from(memory.roulette.values())
    .filter((u) => u.guildId === guildId)
    .sort((a, b) => b.currency - a.currency)
    .slice(0, limit)
    .map((user) => ({
      userId: user.userId,
      lives: user.lives,
      currency: user.currency,
      roundsPlayed: user.roundsPlayed,
      remainingBullets: user.remainingBullets,
    }));
}

function getStatKey(guildId, trackKey) {
  return `${guildId}:${trackKey}`;
}

async function incrementMusicPlay(guildId, trackKey) {
  if (isMongoAvailable()) {
    try {
      await MusicPlayStat.findOneAndUpdate(
        { guildId, trackKey },
        { $inc: { playCount: 1 }, $set: { lastPlayedAt: new Date() } },
        { upsert: true },
      );
      return;
    } catch (err) {
      touchMongoError("incrementMusicPlay mongo error", err);
    }
  }

  const mapKey = getStatKey(guildId, trackKey);
  const existing = memory.musicStats.get(mapKey) || {
    guildId,
    trackKey,
    playCount: 0,
    lastPlayedAt: null,
  };

  existing.playCount += 1;
  existing.lastPlayedAt = new Date();
  memory.musicStats.set(mapKey, existing);
}

async function findMusicStatsByTrackKeys(guildId, trackKeys) {
  if (!Array.isArray(trackKeys) || trackKeys.length === 0) return [];

  if (isMongoAvailable()) {
    try {
      return await MusicPlayStat.find(
        { guildId, trackKey: { $in: trackKeys } },
        { trackKey: 1, playCount: 1 },
      ).lean();
    } catch (err) {
      touchMongoError("findMusicStatsByTrackKeys mongo error", err);
    }
  }

  return trackKeys
    .map((trackKey) => memory.musicStats.get(getStatKey(guildId, trackKey)))
    .filter(Boolean)
    .map((item) => ({ trackKey: item.trackKey, playCount: item.playCount }));
}

async function getTopMusicStats(guildId, limit = 10) {
  if (isMongoAvailable()) {
    try {
      return await MusicPlayStat.find({ guildId })
        .sort({ playCount: -1, lastPlayedAt: -1 })
        .limit(limit)
        .lean();
    } catch (err) {
      touchMongoError("getTopMusicStats mongo error", err);
    }
  }

  return Array.from(memory.musicStats.values())
    .filter((row) => row.guildId === guildId)
    .sort((a, b) => {
      if (b.playCount !== a.playCount) return b.playCount - a.playCount;
      return (
        new Date(b.lastPlayedAt || 0).getTime() -
        new Date(a.lastPlayedAt || 0).getTime()
      );
    })
    .slice(0, limit)
    .map((row) => ({ ...row }));
}

async function clearMusicStats(guildId) {
  if (isMongoAvailable()) {
    try {
      return await MusicPlayStat.deleteMany({ guildId });
    } catch (err) {
      touchMongoError("clearMusicStats mongo error", err);
    }
  }

  let deletedCount = 0;
  for (const mapKey of Array.from(memory.musicStats.keys())) {
    if (mapKey.startsWith(`${guildId}:`)) {
      memory.musicStats.delete(mapKey);
      deletedCount += 1;
    }
  }

  return { deletedCount };
}

module.exports = {
  getQueue,
  saveQueue,
  getAllQueues,
  addPet,
  getPetCount,
  setPetCooldown,
  clearPetCooldown,
  getPet,
  getTopPetters,
  getRouletteUser,
  saveRouletteUser,
  resetRouletteLives,
  getTopRouletteUsers,
  incrementMusicPlay,
  findMusicStatsByTrackKeys,
  getTopMusicStats,
  clearMusicStats,
};
