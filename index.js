// Directions:
// https://db-migrate.readthedocs.io/en/latest/Developers/contributing/#creating-your-own-driver
//
// Couchbase driver docs:
// http://docs.couchbase.com/sdk-api/couchbase-node-client-2.1.4/Cluster.html
//
// Conventions:
// driver's noSQL API refers to "collections" which Couchbase doesn't have.  We
// use buckets to be collections.
import couchbase from 'couchbase';
import Promise from 'bluebird';
import Base from 'db-migrate-base';
import bunyan from 'bunyan';
import PrettyStream from 'bunyan-prettystream';

const prettyStdOut = new PrettyStream();
prettyStdOut.pipe(process.stdout);

let type = null;

const log = bunyan.createLogger({
  name: 'db-migrate-couchbase',
  streams: [{
    level: 'debug',
    type: 'raw',
    stream: prettyStdOut,
  }],
});

let internalLogger = null;

const DEFAULTS = {
  host: (process.env.DOCKER_IP || 'localhost'),
  port: 8091,
  user: 'admin',
  password: 'admin',
};

const CouchbaseDriver = Base.extend({
  init: function (connection, internals, config) {
    log.info('init');
    this._super(internals);
    this.connection = connection;
    this.user = config.user;
    this.password = config.password;
    this.manager = connection.manager(connection, this.user, this.password);
    this.active = null;
  },

  /**
   * Creates a bucket with a given name, and sets it to be active.
   */
  createBucket: function (bucketName, options, callback) {
    return this.manager.createBucket(bucketName, (options || {}), (err) => {
      log.info('Created bucket', { bucketName, err });
      this.active = this.connection.openBucket(bucketName);
      return callback(err, this.active);
    });
  },

  /**
   * Drops a bucket.
   */
  dropBucket: function (bucketName, callback) {
    return this.manager.removeBucket(bucketName, (err) => {
      log.info('Removed bucket', { bucketName, err });
      return callback(err);
    });
  },

  /**
   * Adds an index to a collection
   *
   * @param collectionName  - The collection to add the index to
   * @param indexName       - The name of the index to add
   * @param columns         - The columns to add an index on
   * @param	unique          - A boolean whether this creates a unique index
   */
  addIndex: function (bucketName, indexName, columns, unique, callback) {
    const cols = columns.map(c => `\`${c}\``).join(', ');

    const n1ql = couchbase.N1qlQuery.fromString(`CREATE INDEX
    ${indexName} on ${bucketName} ( ${cols} ) using GSI`);

    const bucket = this.connection.openBucket(bucketName);
    bucket.query(n1ql, (err, res) => {
      console.log(`addIndex: ${err} res ${JSON.stringify(res)}`);
      return callback(err, res);
    });
  },

  /**
   * Removes an index from a collection
   *
   * @param collectionName  - The collection to remove the index
   * @param indexName       - The name of the index to remove
   * @param columns
   */
  removeIndex: function (indexName, callback) {
    log.info('Dropping index', { indexName });
    return this.runN1ql(`DROP INDEX \`${this.active._name}\`.\`${indexName}\``, {}, callback);
  },

  /**
   * Opens the specified bucket, sets it active, and returns it.
   * @param bucketName the name of the bucket to use
   * @returns self, for chaining
   */
  withBucket: function (bucketName) {
    let bucket = null;

    const onBucketOpen = (err) => {
      if (err) {
        log.error('Failed to open bucket', { bucketName, err });
      }
    };

    log.info('Opening bucket', { bucketName });
    bucket = this.connection.openBucket(bucketName, onBucketOpen);
    this.active = bucket;
    return this;
  },

  runN1ql: function (query, params, callback) {
    const n1ql = couchbase.N1qlQuery.fromString(query);

    if (!this.active) {
      return callback('No active bucket');
    }

    return this.active.query(n1ql, params, (err, rows, meta) => {
      console.log(`QUERY RESULTS: ${JSON.stringify(rows)} META ${JSON.stringify(meta)}`);
      return callback(err, rows, meta);
    });
  },

  getBucketNames: function (callback) {
    log.info('Getting bucket names');
    return this.connection.listBuckets(callback);
  },

  /**
   * Gets all the indexes for the active bucket.
   *
   * @param callback
   */
  getIndexes: function (collectionName, callback) {
    log.info('Getting indexes');
    return this.runN1ql('SELECT * FROM system:indexes', {}, callback);
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

  internalLogger = intern.mod.log;
  type = intern.mod.type;

  log.info('Connect', { config, intern });

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
