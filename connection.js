import couchbase from 'couchbase';
const config = require('./database.json');

if (!process.env.COUCHBASE_HOST) {
  throw new Error('COUCHBASE_HOST must be specified');
}

if (!config.couchbase || !config.couchbase.migrationBucket) {
  throw new Error('Your database.json must have a couchbase section with setting migrationBucket');
}

const host = `${process.env.COUCHBASE_HOST}:8091?detailed_errcodes=1`;
console.log(`Connecting to ${host}, opening bucket ${config.couchbase.migrationBucket}`);
const cluster = new couchbase.Cluster(host);
const bucket = cluster.openBucket(config.couchbase.migrationBucket);

export default {
  cluster, bucket,
};
