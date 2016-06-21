import chai from 'chai';
let expect = chai.expect;
const DBMigrate = require('db-migrate');
const driver = DBMigrate.getInstance(true);

describe('Basic test', function () {
  describe('Migrations', function () {
    before(done => {
      driver.addMigrationRecord('TestMigration')
        .then(driver.startMigration)
        .then(driver.allLoadedMigrations)
        .then(migrations => {
          const mine = migrations.filter(m => m.name === 'TestMigration');
          expect(mine).to.be.ok;
          expect(mine.length).to.be.above(0);
        })
        .then(done)
        .catch(err => done(err));
    });

    after(done => {
      driver.deleteMigration('TestMigration')
        .then(driver.allLoadedMigrations)
        .then(migrations => {
          // After we've deleted it, it shouldn't be there.
          for (let i=0; i<migrations.length; i++) {
            expect(migrations[i].name).to.not.equal('TestMigration');
          }

          done();
        })
        .catch(zerr => done(zerr));
    });
  });

  it('should add 2 + 2', done => {
    console.log(driver);
    expect(2 + 2).to.equal(4);
    done();
  });
});
