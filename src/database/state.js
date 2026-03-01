const state = {
  mongoConfigured: false,
  mongoReady: false,
  mysqlConfigured: false,
  mysqlReady: false,
};

function setMongoConfigured(value) {
  state.mongoConfigured = !!value;
}

function setMongoReady(value) {
  state.mongoReady = !!value;
}

function setMySqlConfigured(value) {
  state.mysqlConfigured = !!value;
}

function setMySqlReady(value) {
  state.mysqlReady = !!value;
}

function isMongoAvailable() {
  return state.mongoConfigured && state.mongoReady;
}

function isMySqlAvailable() {
  return state.mysqlConfigured && state.mysqlReady;
}

function getDbState() {
  return { ...state };
}

module.exports = {
  setMongoConfigured,
  setMongoReady,
  setMySqlConfigured,
  setMySqlReady,
  isMongoAvailable,
  isMySqlAvailable,
  getDbState,
};
