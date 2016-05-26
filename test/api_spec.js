import chai from 'chai';
let expect = chai.expect;
import dmCouchbase from '../';

describe('Basic API', function () {
  const config = {
    database: 'couchbase',
    host: 'localhost',
    port: 8091,
  };

  const mockInternals = {
    mod: {
      log: null,
      type: null,
    },
  };

  let driver = null;

  before(done => {
    const cb = (err, d) => {
      if (err) { return done(err); }
      driver = d;
      done();
    }

    dmCouchbase.connect(config, mockInternals, cb);
  });

  const sqlApiMethods = [
    'createTable', 'dropTable', 'renameTable', 'addColumn',
    'removeColumn', 'renameColumn', 'changeColumn', 'addIndex',
    'addForeignKey', 'removeForeignKey', 'insert', 'removeIndex',
    'runSql', 'all',
  ];

  const noSqlApiMethods = [
    'createCollection', 'dropCollection', 'renameCollection',
    'addIndex', 'removeIndex', 'insert',
  ];

  it('should support SQL API, even if not all methods can be implemented', done => {
    sqlApiMethods.forEach(method => {
      expect(driver[method]).to.be.an('function');
    });

    done();
  });

  it('should support NoSQL API, even if not all methods can be implemented', done => {
    noSqlApiMethods.forEach(method => {
      expect(driver[method]).to.be.an('function');
    });

    done();
  });
});
