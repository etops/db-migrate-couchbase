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
const ottoman = require('ottoman');
import moment from 'moment';
import _ from 'lodash';
import deasync from 'deasync';

const prettyStdOut = new PrettyStream();
prettyStdOut.pipe(process.stdout);

/**
 * contains the standard datatypes of db-migrate
 */
let type = null;

const UNSUPPORTED = 'operation not supported';
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
  host: (process.env.COUCHBASE_HOST || 'couchbase://localhost'),
  port: 8091,
  user: 'admin',
  password: 'admin001*',
};

// Escape n1ql identifiers so they are syntactically valid even if they
// contain reserved words.  So foo.bar becomes `foo`.`bar`
const n1qlEscape = (param) => {
  return param.split('.').map(p => `\`${p}\``).join('.');
};

let singleton = null;

const CouchbaseDriver = Base.extend({
  init: function (connection, internals, config) {
    if (singleton) {
      log.warning('You should only create one instance of the db-migrate-couchbase driver');
      return singleton;
    }

    if (internals && internals.argv && internals.argv['sql-file']) {
      throw new Error('This driver does not support the --sql-file option.');
    }

    if (internals && internals.migrationTable !== 'migrations') {
      log.warn('Driver ignores migration table option; it uses ottoman model MigrationRun');
      internals.migrationTable = 'migrations';
    }

    if (internals && internals.seedTable !== 'seeds') {
      log.warn('Driver ignores seed table option; it uses ottoman model MigrationSeed');
      internals.seedTable = 'seeds';
    }

    log.debug('init');
    // console.log(internals);
    this._super(internals);
    this.connection = connection;
    this.user = config.user;
    this.password = config.password;
    this.manager = connection.manager(this.user, this.password);
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
    ottoman.bucket = this.migrationBucket;
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
        // store: this.migrationAdapter,
      });

    this.MigrationSeed = ottoman.model('MigrationSeed', {
      oid: { type: 'string', auto: 'uuid', readonly: true },
      name: { type: 'string' },
      run_on: { type: 'Date' },
      ifNotExists: { type: 'boolean', default: true },
    },
      {
        id: 'oid',
      });

    this.ready = false;

    ottoman.ensureIndices(err => {
      if (err) {
        log.error('Failed to create ottoman indices', { err });
      }

      this.ready = true;
    });

    this.models.MigrationRun = this.MigrationRun;

    singleton = this;

    return singleton;
  },

  activeBucketName: function () {
    return singleton.active._name;
  },

  runN1ql: function (query, params, callback) {
    const n1ql = couchbase.N1qlQuery.fromString(query);

    // Use strong consistency on all migration queries, to avoid errors or missing records
    // owing from cluster synchronization.
    n1ql.consistency(couchbase.N1qlQuery.Consistency.STATEMENT_PLUS);

    if (!singleton.active) {
      return Promise.reject('no active bucket').nodeify(callback);
    }

    if (singleton.internals.dryRun) {
      log.info('DRY RUN', { query, params });
      return Promise.resolve(true).nodeify(callback);
    }

    return new Promise((resolve, reject) => {
      log.info(query);
      return singleton.active.query(n1ql, params, (err, rows, meta) => {
        if (err) {
          log.error('n1ql error', { err });
          return reject(err);
        }

        return resolve({ rows, meta });
      });
    }).nodeify(callback);
  },

  close: function (callback) {
    log.info('close');

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
    return singleton.runN1ql(query, params, callback);
  },

  /**
   * Provided for compatibility with the driver, but this is an alias for runN1ql
   */
  all: function (query, params, callback) {
    log.info('all', { query, params });
    return singleton.runN1ql(query, params, callback);
  },

  /**
   * Queries the migrations table
   *
   * @param callback
   */
  allLoadedMigrations: function (callback) {
    log.info('allLoadedMigrations');

    return new Promise((resolve, reject) => {
      singleton.getModel('MigrationRun').find({},
        {
          sort: ['run_on', 'name'],
          consistency: ottoman.Consistency.GLOBAL,
        },
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
      singleton.MigrationRun.find({
        name: migrationName,
      }, {}, (err, rows) => {
        if (err) { return reject(err); }

        if (rows.length === 0) {
          return resolve(false);
        }

        const deletePromises = rows.map(migRecord => new Promise((delResolve, delReject) => {
          log.info('Deleting migration record ', { migRecord });
          return migRecord.remove(removeErr => {
            if (removeErr) { return delReject(removeErr); }
            return delResolve(true);
          });
        }));

        return Promise.all(deletePromises).then(r => resolve(r));
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

  /**
   * Remembers a model for later reference.
   * @param modelName name of the model
   * @param ottomanModel the actual model
   * @returns the driver instance for chaining.
   */
  registerModel: function (modelName, ottomanModel) {
    singleton.models[modelName] = ottomanModel;
    return singleton;
  },

  /**
   * Return a model that this migration driver knows about
   * @param modelName the name of the model.
   */
  getModel: function (modelName) {
    return singleton.models[modelName];
  },

  /**
   * Create table: just an alias for making an ottoman model
   */
  createTable: function (ottomanModelName, schema, callback) {
    if (ottomanModelName === 'migration') {
      return Promise.resolve(singleton.MigrationRun).nodeify(callback);
    }

    if (ottomanModelName === 'seeds') {
      return Promise.resolve(singleton.MigrationSeed).nodeify(callback);
    }

    log.info('create table / ottoman model', { ottomanModelName, schema });

    // This is a special case, we store migrations under ottoman model MigrationRun.
    // Also, createTable when migration starts creates a table with a field called 'id',
    // which isn't permitted in ottoman.
    if (ottomanModelName === 'migrations') {
      return Promise.resolve(this.MigrationRun).nodeify(callback);
    }

    const model = ottoman.model(ottomanModelName, schema);
    singleton.registerModel(ottomanModelName, model);

    return Promise.resolve(singleton.getModel(ottomanModelName)).nodeify(callback);
  },

  /**
   * Create an ottoman model; alias for createTable
   */
  createOttomanModel: function (ottomanModelName, options, callback) {
    return singleton.createTable(ottomanModelName, options, callback);
  },

  /** unsupported */
  dropTable: function (tableName, options, callback) {
    log.info('dropTable', { tableName, options });
    return Promise.reject(UNSUPPORTED).nodeify(callback);
  },

  dropOttomanModel: function (ottomanModelName, options, callback) {
    return singleton.dropTable(ottomanModelName, options, callback);
  },

  /**
   * Unsupported; renaming a model is easy, but carrying with it and pruning its indexes is hard.
   */
  renameTable: function (ottomanModelName, newOttomanModelName, callback) {
    log.info('renameTable', { ottomanModelName, newOttomanModelName });
    return Promise.reject(UNSUPPORTED).nodeify(callback);
  },

  renameOttomanModel: function (ottomanModelName, newOttomanModelName, callback) {
    return singleton.renameTable(ottomanModelName, newOttomanModelName, callback);
  },

  addColumn: function (ottomanModelName, modelPath, pathSpec, callback) {
    log.info('addColumn', { ottomanModelName, modelPath, pathSpec });

    if (!ottomanModelName) {
      return Promise.reject('missing ottoman model name').nodeify(callback);
    }

    if (!modelPath) {
      return Promise.reject('missing model path').nodeify(callback);
    }

    // TODO -- default value of null won't work for all ottoman types, like
    // Mixed, ref, etc.   But it will work for almost all primitive types.
    // const ottomanType = this.mapDataType(pathSpec);

    const q = `
      UPDATE \`${singleton.active._name}\`
      SET ${n1qlEscape(modelPath)} = null
      WHERE \`${ottomanType}\` = '${ottomanModelName}'`;

    return singleton.runN1ql(q, {}, callback);
  },

  addOttomanPath: function (ottomanModelName, modelPath, pathSpec, callback) {
    return singleton.addColumn(ottomanModelName, modelPath, pathSpec, callback);
  },

  removeColumn: function (ottomanModelName, modelPath, callback) {
    log.info('removeColumn', { ottomanModelName, modelPath });

    const q = `
      UPDATE \`${singleton.active._name}\`
      UNSET ${n1qlEscape(modelPath)}
      WHERE \`${ottomanType}\` = '${ottomanModelName}'`;

    return singleton.runN1ql(q, {}, callback);
  },

  removeOttomanPath: function (ottomanModelName, modelPath, callback) {
    return singleton.removeColumn(ottomanModelName, modelPath, callback);
  },

  /**
   * alias
   * @see renameOttomanPath
   */
  renameColumn: function (ottomanModelName, oldModelPath, newModelPath, callback) {
    log.info('renameColumn', { ottomanModelName, oldModelPath, newModelPath });

    const q = `
      UPDATE \`${singleton.active._name}\`
      SET ${n1qlEscape(newModelPath)} = ${n1qlEscape(oldModelPath)}
      UNSET ${n1qlEscape(oldModelPath)}
      WHERE \`${ottomanType}\` = '${ottomanModelName}'`;

    log.info('renameColumn', { q });
    return singleton.runN1ql(q, {}, callback);
  },

  /**
   * Use this function with care, it does **not** adjust any indexes that might already be
   * on the path, so consider dropping those before doing this.
   */
  renameOttomanPath: function (ottomanModelName, oldModelPath, newModelPath, callback) {
    return singleton.renameColumn(ottomanModelName, oldModelPath, newModelPath, callback);
  },

  changeColumn: function (ottomanModelName, ottomanPathName, pathSpec, callback) {
    log.info('changeColumn', { ottomanModelName, ottomanPathName, pathSpec });
    return Promise.reject(UNSUPPORTED).nodeify(callback);
  },

  /**
   * Couchbase doesn't support this as such, because the concepts of columnNameArrays
   * and valueArrays aren't really a good fit.
   */
  insert: function (tableName, columnNameArray, valueArray, callback) {
    log.info('insert', { tableName, columnNameArray, valueArray });
    return Promise.reject(UNSUPPORTED).nodeify(callback);
  },

  addMigrationRecord: function (name, callback) {
    log.info('addMigrationRecord', { name });
    const i = new singleton.MigrationRun({
      name,
      run_on: moment().utc(),
    });

    return new Promise((resolve, reject) => i.save(err => {
      if (err) { return reject(err); }
      return resolve(true);
    })).nodeify(callback);
  },

  /**
   * Creates a bucket with a given name, and sets it to be active.
   */
  createBucket: function (bucketName, options, callback) {
    log.info('createBucket', { bucketName });

    return new Promise((resolve, reject) => {
      return singleton.manager.createBucket(bucketName, (options || {}), err => {
        if (err) { return reject(err); }
        log.info('Created bucket', { bucketName, err });
        singleton.active = singleton.connection.openBucket(bucketName);
        return resolve(singleton.active);
      });
    }).nodeify(callback);
  },

  /**
   * Drops a bucket.   Note, due to couchbase server implementation and what it
   * takes to drop a bucket, this may take quite some time to resolve (> 1 min, even in
   * small cases).   Do not use this unless you know what you're doing, as this function
   * can destroy quite a lot very quickly.
   */
  dropBucket: function (bucketName, callback) {
    log.info('dropBucket', { bucketName });

    return new Promise((resolve, reject) => singleton.manager.removeBucket(bucketName, (err) => {
      if (err) { return reject(err); }

      // Remove active if we just remove that one, because it's a reference that's
      // no longer valid.
      if (singleton.active._name === bucketName) {
        singleton.active = null;
      }

      return resolve(true);
    })).nodeify(callback);
  },

  changeType: function (ottomanModelName, ottomanPath, oldType, newType, callback) {
    // For various conversions, store functions that perform the conversion on an
    // identifier.  This gets spliced into n1ql.
    // Strings rather than functions are error messages back to the user about why that
    // conversion may not make sense.
    const supported = {
      Date: {
        string: 'Dates and strings are already interchangable',
        number: 'not supported',
      },

      boolean: {
        string: (i) => `TOSTRING(${i})`,
        number: 'Converting booleans to numbers doesn\'t really make sense',
      },

      string: {
        Date: 'Dates and strings are already interchangeable',
        boolean: (i) => `TOBOOLEAN(${i})`,
        number: (i) => `TONUMBER(${i})`,
      },

      number: {
        string: (i) => `TOSTRING(${i})`,
        boolean: (i) => `TOBOOLEAN(${i})`,
        Date: 'not supported',
      },
    };

    log.info('changeType', { ottomanModelName, ottomanPath, oldType, newType });

    // Error conditions to check, before we issue a query that could damage data.
    if (!ottomanModelName || !ottomanPath || !oldType || !newType) {
      return Promise.reject('Missing required argument').nodeify(callback);
    } else if (oldType === newType) {
      return Promise.reject('Cannot convert from one type to itself').nodeify(callback);
    } else if (!supported[oldType]) {
      return Promise.reject(`Conversion of type ${oldType} is not supported`);
    } else if (!supported[oldType][newType]) {
      return Promise.reject(`Type ${oldType} does not have a supported conversion to ${newType}`);
    }

    const conversion = supported[oldType][newType];
    if (typeof conversion === 'string') {
      return Promise.reject(`Can't convert ${oldType} to ${newType}: ${conversion}`)
        .nodeify(callback);
    }

    const p = n1qlEscape(ottomanPath);
    const query = `UPDATE \`${singleton.active._name}\`
    SET ${p} = ${conversion(p)}
    WHERE \`${ottomanType}\`='${ottomanModelName}'`;

    return singleton.runN1ql(query);
  },

  /**
   * Adds an index to a collection
   * @param ottomanModelName the name of the ottoman model
   * @param indexName - The name of the index to add
   * @param columns - The columns to add an index on
   * @param callback
   */
  addIndex: function (ottomanModelName, indexName, columns, callback) {
    log.info('Add Index', { indexName, columns, ottomanModelName });

    let srcCols = columns;

    if (typeof columns === 'string') {
      srcCols = [columns];
    }

    const cols = srcCols.map(c => n1qlEscape(c)).join(', ');

    const n1ql = `
      CREATE INDEX \`${indexName}\` ON \`${singleton.active._name}\` (
        ${cols}
      )
      WHERE \`${ottomanType}\`='${ottomanModelName}'`;

    return singleton.runN1ql(n1ql, {}, callback);
  },

  /**
   * Removes an index from a collection
   *
   * @param collectionName  - The collection to remove the index
   * @param indexName       - The name of the index to remove
   * @param columns
   */
  removeIndex: function (indexName, callback) {
    log.info('removeIndex', { indexName });
    return singleton.runN1ql(`DROP INDEX \`${singleton.active._name}\`.\`${indexName}\``, {}, callback);
  },

  /**
   * Opens the specified bucket, sets it active, and returns it.
   * @param bucketName the name of the bucket to use
   * @returns self, for chaining
   */
  withBucket: function (bucketName) {
    let bucket = null;

    return new Promise((resolve, reject) => {
      const onBucketOpen = (err) => {
        if (err) {
          log.error('Failed to open bucket', { bucketName, err });
          return reject(err);
        }

        singleton.active = bucket;
        return resolve(singleton);
      };

      log.info('Opening active bucket', { bucketName });
      bucket = singleton.connection.openBucket(bucketName, onBucketOpen);
    });
  },

  getBucketNames: function (callback) {
    log.info('getBucketNames');

    return new Promise((resolve, reject) => singleton.manager.listBuckets((err, buckets) => {
      if (err) { return reject(err); }

      // log.info('Buckets', { buckets });
      return resolve(buckets);
    })).nodeify(callback);
  },

  /**
   * Gets all the indexes for the active bucket.
   *
   * @param callback
   */
  getIndexes: function (callback) {
    log.info('getIndexes');
    return singleton.runN1ql('SELECT * FROM system:indexes', {}, callback);
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
  internalLogger = (intern.mod.log || log);
  type = intern.mod.type;

  // log.info('Connect', { config, intern, type });

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
    if (intern.interfaces && intern.interfaces.MigratorInterface) {
      intern.interfaces.MigratorInterface[f] = function (...args) {
        return Promise.reject('Not implemented')
          .nodeify(args[args.length - 1]);
      };
    }
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

  deasync.loopWhile(() => !driver.ready);

  if (config.bucket) {
    return driver.withBucket(config.bucket)
      .then(d => callback(null, d));
  }

  return callback(null, new CouchbaseDriver(db, intern, config));
};

module.exports = { connect };
