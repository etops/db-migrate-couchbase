import couchbase from 'couchbase';
const config = require('./database.json');

if (!process.env.COUCHBASE_PORT_8091_TCP_ADDR) {
  throw new Error('COUCHBASE_PORT_8091_TCP_ADDR must be specified');
}

if (!process.env.COUCHBASE_PORT_8091_TCP_PORT) {
  throw new Error('COUCHBASE_PORT_8091_TCP_PORT must be specified');
}

if (!config.couchbase || !config.couchbase.migrationBucket) {
  throw new Error('Your database.json must have a couchbase section with setting migrationBucket');
}

const host = `couchbase://${process.env.COUCHBASE_PORT_8091_TCP_ADDR}:${process.env.COUCHBASE_PORT_8091_TCP_PORT}?detailed_errcodes=1`;
console.log(`Connecting to ${host}, opening bucket ${config.couchbase.migrationBucket}`);
const cluster = new couchbase.Cluster(host);
const bucket = cluster.openBucket(config.couchbase.migrationBucket);

export default {
  cluster, bucket,
};
