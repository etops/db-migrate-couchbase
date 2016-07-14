'use strict';

var dbm;
var type;
var seed;

/**
  * We receive the dbmigrate dependency from dbmigrate initially.
  * This enables us to not have to rely on NODE_PATH.
  */
exports.setup = function(options, seedLink) {
  console.log('SECOND MIGRATION');
  console.log(JSON.stringify(options));
  console.log(JSON.stringify(seedLink));
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = function(db) {
  console.log('SECOND MIGRATE: UP');

  return db
    .addColumn('Test', 'newerAttribute', { type: 'number' })
    .then(() => db.runSql('UPDATE default SET newerAttribute=12345.6789 WHERE _type=\'Test\''))
    .then(() => db.renameColumn('Test', 'renamedColumn', 'againRenamedColumn'))
    .then(() => console.log('SECOND MIGRATE: UP (done)'));
};

exports.down = function(db) {
  console.log('SECOND MIGRATE: DOWN');

  return db
    .removeColumn('Test', 'newerAttribute')
    .then(() => db.renameColumn('Test', 'againRenamedColumn', 'renamedColumn'))
    .then(() => console.log('SECOND MIGRATE: DOWN (done)'));
};
