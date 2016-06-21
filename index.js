// Directions:
// https://db-migrate.readthedocs.io/en/latest/Developers/contributing/#creating-your-own-driver
//
// Couchbase driver docs:
// http://docs.couchbase.com/sdk-api/couchbase-node-client-2.1.4/Cluster.html
//
// Conventions:
// driver's noSQL API refers to "collections" which Couchbase doesn't have.  We
// use buckets to be collections.
// RDBMS "Tables" are Ottoman models.
// RDBMS "Rows" are ottoman model instances (documents)
// RDBMS "Columns" are paths into an ottoman model.  Not just attributes, but paths.
// RDBMS "Databases" are Couchbase buckets.
import couchbase from 'couchbase';
import Promise from 'bluebird';
import Base from 'db-migrate-base';
import bunyan from 'bunyan';
import PrettyStream from 'bunyan-prettystream';
import ottoman from 'ottoman';
import moment from 'moment';
import _ from 'lodash';

const prettyStdOut = new PrettyStream();
prettyStdOut.pipe(process.stdout);

/**
 * contains the standard datatypes of db-migrate
 */
let type = null;

const ottomanType = '_type';

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
  host: (process.env.COUCHBASE_HOST || 'localhost'),
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
    this.models = {};

    if (!config.migrationBucket) {
      throw new Error('Configuration must specify migrationBucket');
    }

    this.migrationBucket = this.connection.openBucket(config.migrationBucket, (err) => {
      if (err) {
        throw new Error(`Could not open migration bucket: ${err}`, err);
      }
    });

    this.active = this.migrationBucket;
    this.migrationAdapter = new ottoman.StoreAdapter.Couchbase(this.migrationBucket);

    // Property names are obligatory here; the migrate framework expects exactly these,
    // "name" and "run_on"
    this.MigrationRun = ottoman.model('MigrationRun', {
      oid: { type: 'string', auto: 'uuid', readonly: true },
      name: { type: 'string' },
      run_on: { type: 'Date' },
    },
      {
        id: 'oid',
        store: this.migrationAdapter,
      });

    this.models.MigrationRun = this.MigrationRun;
  },

  _runN1ql: function (query, params, callback) {
    const n1ql = couchbase.N1qlQuery.fromString(query);

    if (!this.active) {
      return callback('No active bucket');
    }

    const self = this;

    if (this.internals.dryRun) {
      log.info('runN1ql dry run', { query, params });
      return Promise.resolve(true).nodeify(callback);
    }

    return new Promise((resolve, reject) => {
      return self.active.query(n1ql, params, (err, rows, meta) => {
        if (err) {
          log.error('n1ql error', { err });
          return reject(err);
        }

        log.info('Successfully ran query');
        return resolve({ rows, meta });
      });
    }).nodeify(callback);
  },

  close: function (callback) {
    log.info('Close');

    // Couchbase doesn't disconnect nicely, leaves open threads.
    setTimeout(() => {
      log.info('Time!');
      process.exit(0);
    }, 5000);

    callback();
  },

  /**
   * Provided for compatibility with the driver, but this is an alias for runN1ql
   */
  runSql: function (query, params, callback) {
    log.info('runSql', { query, params });
    return this._runN1ql(query, params, callback);
  },

  /**
   * Provided for compatibility with the driver, but this is an alias for runN1ql
   */
  all: function (query, params, callback) {
    log.info('all', { query, params });
    return this._runN1ql(query, params, callback);
  },

  /**
   * Queries the migrations table
   *
   * @param callback
   */
  allLoadedMigrations: function (callback) {
    log.info('allLoadedMigrations');

    return new Promise((resolve, reject) => {
      this.MigrationRun.find({},
        { sort: ['run_on', 'name'] },
        (err, models) => {
          if (err) { return reject(err); }
          return resolve(models);
        });
    }).nodeify(callback);
  },

  /**
   * Deletes a migration
   *
   * @param migrationName   - The name of the migration to be deleted
   * @param callback
   */
  deleteMigration: function (migrationName, callback) {
    log.info('deleteMigration', { migrationName });
    return new Promise((resolve, reject) => {
      this.MigrationRun.find({
        name: migrationName,
      }, {}, (err, rows) => {
        if (err) { return reject(err); }

        if (rows.length > 1) {
          return reject(`Too many migrations named ${migrationName}`);
        } else if (rows.length === 0) {
          // Nothing to delete.
          return resolve(false);
        }

        return rows[0].remove(removeErr => {
          if (removeErr) { return reject(removeErr); }

          return resolve(true);
        });
      });
    }).nodeify(callback);
  },

  mapDataType: function (spec) {
    const map = {};

    const ottomanTypes = ['string', 'integer', 'Date', 'number', 'boolean', 'Mixed'];

    // Already an ottoman type?
    if (ottomanTypes.indexOf(spec.type) !== -1) {
      return spec.type;
    }

    map[type.TEXT] = map[type.CHAR] = map[type.STRING] = 'string';
    map[type.INTEGER] = map[type.SMALLINT] = 'integer';
    map[type.BIGINT] = 'string';
    map[type.REAL] = map[type.DECIMAL] = map[type.REAL] = 'number';
    map[type.BOOLEAN] = 'boolean';
    map[type.DATE] = map[type.DATE_TIME] = 'Date';
    map[type.BLOB] = 'string';
    map[type.TIME] = 'string';
    map[type.BINARY] = 'string';

    if (spec.type in map) {
      return map[spec.type];
    }

    return 'string';
  },

  /**
   * Unsupported; if Couchbase supported transactions, here's where
   * START TRANSACTION would go.
   */
  startMigration: function (cb) {
    log.info('startMigration');
    return Promise.resolve(true).nodeify(cb);
  },

  /**
   * Unsupported; if Couchbase supported transactions, here's where
   * COMMIT would go.
   */
  endMigration: function (cb) {
    log.info('endMigration');
    return Promise.resolve(true).nodeify(cb);
  },

  registerModel: function (modelName, ottomanModel) {
    this.models[modelName] = ottomanModel;
    return this;
  },

  /**
   * Return a model that this migration driver knows about
   * @param modelName the name of the model.
   */
  getModel: function (modelName) {
    return this.models[modelName];
  },

  /**
   * Create table: unsupported.
   */
  createTable: function (ottomanModelName, options, callback) {
    if (ottomanModelName === 'migration') {
      return Promise.resolve(this.MigrationRun).nodeify(callback);
    }

    const schema = {};
    const modelOpts = {};

    _.forOwn(options.columns, (value, key) => {
      // Skip id, ottoman does that auto.
      if (key === 'id') { return; }

      schema[key] = this.mapDataType(value);
    });

    this.models[ottomanModelName] = ottoman.model(ottomanModelName, schema, modelOpts);

    log.info('create table / ottoman model', { ottomanModelName, options, schema, modelOpts });
    return Promise.resolve(this.models[ottomanModelName]).nodeify(callback);
  },

  createOttomanModel: function (ottomanModelName, options, callback) {
    return this.createTable(ottomanModelName, options, callback);
  },

  dropTable: function (tableName, options, callback) {
    log.info('dropTable', { tableName, options });

    // TODO -- the analogue in couchbase world would be to delete all ottoman
    // model instances under the name tableName.  Do we really want to do that?

    return Promise.resolve(true).nodeify(callback);
  },

  dropOttomanModel: function (ottomanModelName, options, callback) {
    return this.dropTable(ottomanModelName, options, callback);
  },

  renameTable: function (ottomanModelName, newOttomanModelName, callback) {
    log.info('renameTable', { ottomanModelName, newOttomanModelName });

    // If tableName is equivalent to ottoman model name, we update that by changing the
    // _type attribute.
    //
    // TODO -- ensure no naming clash with newTableName.
    const n1ql = `
      UPDATE ${this.active._name}
      SET \`${ottomanType}\`='${newOttomanModelName}'
      WHERE \`${ottomanType}\`='${ottomanModelName}'`;

    return this._runN1ql(n1ql, {}, callback);
  },

  renameOttomanModel: function (ottomanModelName, newOttomanModelName, callback) {
    return this.renameTable(ottomanModelName, newOttomanModelName, callback);
  },

  addColumn: function (ottomanModelName, modelPath, pathSpec, callback) {
    log.info('addColumn', { ottomanModelName, modelPath, pathSpec, t: this });

    // TODO -- default value of null won't work for all ottoman types, like
    // Mixed, ref, etc.   But it will work for almost all primitive types.
    // const ottomanType = this.mapDataType(pathSpec);

    const q = `
      UPDATE \`${this.active._name}\`
      SET \`${modelPath}\` = null
      WHERE \`${ottomanType}\` = '${ottomanModelName}'`;

    return this._runN1ql(q, {}, callback);
  },

  addOttomanPath: function (ottomanModelName, modelPath, pathSpec, callback) {
    return this.addColumn(ottomanModelName, modelPath, pathSpec, callback);
  },

  removeColumn: function (ottomanModelName, modelPath, callback) {
    log.info('removeColumn', { ottomanModelName, modelPath });

    const q = `
      UPDATE \`${this.active._name}\`
      UNSET \`${modelPath}\`
      WHERE \`${ottomanType}\` = '${ottomanModelName}'`;

    return this._runN1ql(q, {}, callback);
  },

  removeOttomanPath: function (ottomanModelName, modelPath, callback) {
    return this.removeColumn(ottomanModelName, modelPath, callback);
  },

  renameColumn: function (ottomanModelName, oldModelPath, newModelPath, callback) {
    log.info('renameColumn', { ottomanModelName, oldModelPath, newModelPath });

    const q = `
      UPDATE \`${this.active._name}\`
      SET \`${newModelPath}\` = \`${oldModelPath}\`
      UNSET \`${oldModelPath}\`
      WHERE \`${ottomanType}\` = '${ottomanModelName}'`;

    return this._runN1ql(q, {}, callback);
  },

  renameOttomanPath: function (ottomanModelName, oldModelPath, newModelPath, callback) {
    return this.renameColumn(ottomanModelName, oldModelPath, newModelPath, callback);
  },

  changeColumn: function (tableName, columnName, columnSpec, callback) {
    log.info('changeColumn - NOT YET IMPLEMENTED', { tableName, columnName, columnSpec });
    return Promise.resolve(true).nodeify(callback);
  },

  insert: function (tableName, columnNameArray, valueArray, callback) {
    log.info('insert - NOT YET IMPLEMENTED', { tableName, columnNameArray, valueArray });
    return Promise.resolve(true).nodeify(callback);
  },

  addMigrationRecord: function (name, callback) {
    log.info('Add migration record', { name });
    const i = new this.MigrationRun({
      name,
      run_on: moment().utc(),
    });

    return new Promise((resolve, reject) => {
      return i.save(err => {
        if (err) { return reject(err); }
        return resolve(true);
      });
    }).nodeify(callback);
  },

  /**
   * Creates a bucket with a given name, and sets it to be active.
   */
  createBucket: function (bucketName, options, callback) {
    log.info('Create bucket', { bucketName });
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
    log.info('Drop bucket', { bucketName });

    return this.manager.removeBucket(bucketName, (err) => {
      log.info('Removed bucket', { bucketName, err });
      return callback(err);
    });
  },

  /**
   * Adds an index to a collection
   *
   * @param indexName - The name of the index to add
   * @param columns - The columns to add an index on
   * @param	unique - A boolean whether this creates a unique index (UNUSED FOR COUCHBASE)
   */
  addIndex: function (indexName, columns, unique, callback) {
    log.info('Add Index', { indexName, columns, unique });
    const cols = columns.map(c => `\`${c}\``).join(', ');

    const n1ql = couchbase.N1qlQuery.fromString(`CREATE INDEX
    ${indexName} on ${this.active._name} ( ${cols} ) using GSI`);

    this.active.query(n1ql, (err, res) => {
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
    return this._runN1ql(`DROP INDEX \`${this.active._name}\`.\`${indexName}\``, {}, callback);
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

    log.info('Opening active bucket', { bucketName });
    bucket = this.connection.openBucket(bucketName, onBucketOpen);
    this.active = bucket;
    return this;
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
    return this._runN1ql('SELECT * FROM system:indexes', {}, callback);
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
  internalLogger = intern.mod.log;
  type = intern.mod.type;

  log.info('Connect', { config, intern, type });

  let port;
  if (config.port === undefined) {
    port = DEFAULTS.port;
  } else {
    port = config.port;
  }

  /* Export functions to the interface that are not normally part
   * of the migration interface.
   */
  const exportable = [
    'runN1ql', 'registerModel', 'getModel', 'createOttomanModel',
    'renameOttomanModel', 'addOttomanPath', 'removeOttomanPath',
    'renameOttomanPath', 'createBucket', 'dropBucket',
    'withBucket', 'getBucketNames', 'getIndexes',
  ];

  exportable.forEach(f => {
    /* eslint no-param-reassign: "off" */
    intern.interfaces.MigratorInterface[f] = function () {
      return new Promise((resolve, reject) => {
        return reject('Not implemented');
      }).nodeify(arguments[arguments.length - 1]);
    };
    return f;
  });

  let cluster = null;

  if (config.host === undefined) {
    cluster = `${DEFAULTS.host}:${port}?detailed_errcodes=1`;
  } else {
    cluster = `${config.host}:${port}?detailed_errcodes=1`;
  }

  log.info('Connecting to cluster', { cluster });
  const db = new couchbase.Cluster(cluster);

  const driver = new CouchbaseDriver(db, intern, config);

  if (config.bucket) {
    return callback(null, driver.withBucket(config.bucket));
  }

  return callback(null, new CouchbaseDriver(db, intern, config));
};

module.exports = { connect };
