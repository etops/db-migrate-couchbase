// Directions:
// https://db-migrate.readthedocs.io/en/latest/Developers/contributing/#creating-your-own-driver
import util from 'util';
import moment from 'moment';
import ottoman from 'ottoman';
import couchbase from 'couchbase';
import Promise from 'bluebird';
import Base from 'db-migrate-base';

let type = null;
let log = null;

const DEFAULTS = {
  host: 'localhost',
  port: 8091,
};

const CouchbaseDriver = Base.extend({
  init: function (connection, internals, config) {
    this._super(internals);
    this.connection = connection;
    this.user = config.user;
    this.password = config.password;
    this.manager = connection.manager(connection, this.user, this.password);
  },

  /**
   * Creates the migrations collection
   *
   * @param callback
   */
  _createMigrationsCollection: function (callback) {

  },

  /**
   * Creates the seed collection
   *
   * @param callback
   */
  _createSeedsCollection: function (callback) {

  },

  /**
   * An alias for _createMigrationsCollection
   */
  createMigrationsTable: function (callback) {
    return this._createMigrationsCollection(callback);
  },

  /**
   * An alias for _createSeederCollection
   */
  createSeedsTable: function (callback) {
    return this._createSeedsCollection(callback);
  },

  /**
   * Creates a collection
   *
   * @param collectionName  - The name of the collection to be created
   * @param callback
   */
  createCollection: function (collectionName, callback) {

  },

  switchDatabase: function (options, callback) {

  },

  createDatabase: function (dbName, options, callback) {

  },

  dropDatabase: function (dbName, options, callback) {

  },

  /**
   * An alias for createCollection
   *
   * @param collectionName  - The name of the collection to be created
   * @param callback
   */
  createTable: function (collectionName, callback) {
    return this.createCollection(collectionName, callback);
  },

  /**
   * Drops a collection
   *
   * @param collectionName  - The name of the collection to be dropped
   * @param callback
   */
  dropCollection: function (collectionName, callback) {

  },

  /**
   * An alias for dropCollection
   *
   * @param collectionName  - The name of the collection to be dropped
   * @param callback
   */
  dropTable: function (collectionName, callback) {
    return this.dropCollection(collectionName, callback);
  },

  /**
   * Renames a collection
   *
   * @param collectionName    - The name of the existing collection to be renamed
   * @param newCollectionName - The new name of the collection
   * @param callback
   */
  renameCollection: function (collectionName, newCollectionName, callback) {

  },

  /**
   * An alias for renameCollection
   *
   * @param collectionName    - The name of the existing collection to be renamed
   * @param newCollectionName - The new name of the collection
   * @param callback
   */
  renameTable: function (collectionName, newCollectionName, callback) {
    return this.renameCollection(collectionName, newCollectionName)
  },

  /**
   * Adds an index to a collection
   *
   * @param collectionName  - The collection to add the index to
   * @param indexName       - The name of the index to add
   * @param columns         - The columns to add an index on
   * @param	unique          - A boolean whether this creates a unique index
   */
  addIndex: function (collectionName, indexName, columns, unique, callback) {

  },

  /**
   * Removes an index from a collection
   *
   * @param collectionName  - The collection to remove the index
   * @param indexName       - The name of the index to remove
   * @param columns
   */
  removeIndex: function (collectionName, indexName, callback) {

  },

  /**
   * Inserts a record(s) into a collection
   *
   * @param collectionName  - The collection to insert into
   * @param toInsert        - The record(s) to insert
   * @param callback
   */
  insert: function (collectionName, toInsert, callback) {

  },

  /**
   * Inserts a migration record into the migration collection
   *
   * @param name                - The name of the migration being run
   * @param callback
   */
  addMigrationRecord: function (name, callback) {

  },

  /**
   * Inserts a seeder record into the seeder collection
   *
   * @param name                - The name of the seed being run
   * @param callback
   */
  addSeedRecord: function (name, callback) {

  },

  /**
   * Runs a query
   *
   * @param collectionName  - The collection to query on
   * @param query           - The query to run
   * @param callback
   */
  _find: function (collectionName, query, callback) {

  },

  /**
   * Gets all the collection names in couchbase.
   *
   * @param callback  - The callback to call with the collection names
   */
  _getCollectionNames: function (callback) {

  },

  /**
   * Gets all the indexes for a specific collection
   *
   * @param collectionName  - The name of the collection to get the indexes for
   * @param callback        - The callback to call with the collection names
   */
  _getIndexes: function (collectionName, callback) {
  },

  _makeParamArgs: function (args) {

  },

  /**
   * Runs a NoSQL command regardless of the dry-run param
   */
  _all: function () {

  },

  /**
   * Queries the migrations collection
   *
   * @param callback
   */
  allLoadedMigrations: function (callback) {

  },

  /**
   * Queries the seed collection
   *
   * @param callback
   */
  allLoadedSeeds: function (callback) {

  },

  /**
   * Deletes a migration
   *
   * @param migrationName       - The name of the migration to be deleted
   * @param callback
   */
  deleteMigration: function (migrationName, callback) {

  },

  /**
   * Deletes a migration
   *
   * @param migrationName       - The name of the migration to be deleted
   * @param callback
   */
  deleteSeed: function (migrationName, callback) {

  },
});

Promise.promisifyAll(CouchbaseDriver);

/**
 * Gets a connection to couchbase
 *
 * @param config    - The config to connect to couchbase
 * @param callback  - The callback to call with a CouchbaseDriver object
 */
const connect = (config, intern, callback) => {
  let port;
  let host;

  log = intern.mod.log;
  type = intern.mod.type;

  // Make sure the database is defined
  if (config.database === undefined) {
    throw new Error('database must be defined in database.json');
  }

  if (config.port === undefined) {
    port = DEFAULTS.port;
  } else {
    port = config.port;
  }

  if (config.host === undefined) {
    host = `${DEFAULTS.host}:${port}`;
  } else {
    host = `${config.host}:${port}`;
  }

  const db = config.db || new couchbase.Cluster(host);
  callback(null, new CouchbaseDriver(db, intern, config));
};

export default { connect };
