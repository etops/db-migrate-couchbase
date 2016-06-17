import couchbase from 'couchbase';
const config = require('./database.json');

if (!process.env.COUCHBASE_HOST) {
  throw new Error('COUCHBASE_HOST must be specified');
}

const host = `couchbase://${process.env.COUCHBASE_HOST}:8091?detailed_errcodes=1`;
console.log(`Connecting to ${host}`);
const cluster = new couchbase.Cluster(host);
const bucket = cluster.openBucket(config.couchbase.migrationBucket);

export default {
  cluster, bucket,
};
