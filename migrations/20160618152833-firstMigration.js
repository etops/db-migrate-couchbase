'use strict';

var dbm;
var type;
var seed;

/**
  * We receive the dbmigrate dependency from dbmigrate initially.
  * This enables us to not have to rely on NODE_PATH.
  */
exports.setup = function (options, seedLink) {
  console.log('FIRST MIGRATION');
  console.log(JSON.stringify(options));
  console.log(JSON.stringify(seedLink));
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = function (db) {
  console.log('FIRST MIGRATE: UP');

  return db
    .addColumn('Test', 'newAttribute', { type: 'string' })
    .then(() => db.runSql('UPDATE default SET newAttribute=\'FOO\' WHERE _type=\'Test\''))
    .then(() => db.renameColumn('Test', 'renameMe', 'renamedColumn'))
    .then(() => db.removeColumn('Test', 'removeMe'))
    .then(() => console.log('FIRST MIGRATE: UP (done)'));
};

exports.down = function (db) {
  console.log('FIRST MIGRATE: DOWN');

  return db
    .removeColumn('Test', 'newAttribute')
    .then(() => db.addColumn('Test', 'removeMe', { type: 'string ' }))
    .then(() => db.renameColumn('Test', 'renamedColumn', 'renameMe'))
    .then(() => console.log('FIRST MIGRATE: DOWN (done)'));
};
