import chai from 'chai';
let expect = chai.expect;
const DBMigrate = require('db-migrate');
import driverModule from '../index.js';
let driver = null;
const inst = DBMigrate.getInstance(true);

describe('db-migrate-couchbase', function () {
  this.timeout(10000);

  before(done => {
    const config = inst.config.dev;
    const intern = {
      mod: {
        type: inst.dataTypes,
      },
      interfaces: {
        MigratorInterface: {},
      },
    };

    console.dir(inst);

    driverModule.connect(config, intern, function (err, d) {
      if (err) { return done(err); }
      driver = d;
      return done();
    });
  });

  describe('Migrations', function () {
    before(done => {
      driver.addMigrationRecord('TestMigration')
        .then(driver.startMigration)
        .then(driver.allLoadedMigrations)
        .then(migrations => {
          console.log('MIGRATIONS: ' + migrations);
          const mine = migrations.filter(m => m.name === 'TestMigration');
          expect(mine).to.be.ok;
          expect(mine.length).to.be.above(0);
        })
        .then(() => {
          return done();
        })
        .catch(err => done(err));
    });

    it('should be good', done => {
      done();
    });

    after(done => {
      console.log('AFTER DRIVER: ' + driver);
      driver.deleteMigration('TestMigration')
        .then(driver.allLoadedMigrations)
        .then(migrations => {
          // After we've deleted it, it shouldn't be there.
          for (let i = 0; i < migrations.length; i++) {
            expect(migrations[i].name).to.not.equal('TestMigration');
          }

          done();
        })
        .catch(zerr => done(zerr));
    });
  });

  it('should add 2 + 2', done => {
    expect(2 + 2).to.equal(4);
    done();
  });
});
