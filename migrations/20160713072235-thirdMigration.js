'use strict';

var dbm;
var type;
var seed;

/**
  * We receive the dbmigrate dependency from dbmigrate initially.
  * This enables us to not have to rely on NODE_PATH.
  */
exports.setup = function(options, seedLink) {
  console.log('THIRD MIGRATION');
  console.log(JSON.stringify(options));
  console.log(JSON.stringify(seedLink));
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = function(db) {
  console.log('THIRD MIGRATE: UP');

  return db
    .renameColumn('Test', 'newerAttribute', 'newestAttribute')
    .then(() => db.addColumn('Test', 'anotherAttribute', { type: 'date', default: Date.now }))
    .then(() => console.log('THIRD MIGRATE: UP (done)'));
};

exports.down = function(db) {
  console.log('THIRD MIGRATE: DOWN');

  return db
    .renameColumn('Test', 'newestAttribute', 'newerAttribute')
    .then(() => db.removeColumn('Test', 'anotherAttribute'))
    .then(() => console.log('THIRD MIGRATE: DOWN (done)'));
};
