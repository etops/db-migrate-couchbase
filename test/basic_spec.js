import chai from 'chai';
let expect = chai.expect;
const DBMigrate = require('db-migrate');
import driverModule from '../index.js';
let driver = null;
const config = require('../database.json').dev;
const inst = DBMigrate.getInstance(true);

describe('db-migrate-couchbase', function () {
  this.timeout(60000);

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
          const mine = migrations.filter(m => m.name === 'TestMigration');
          expect(mine).to.be.ok;
          expect(mine.length).to.be.above(0);
        })
        .then(() => {
          return done();
        })
        .catch(err => done(err));
    });

    describe('Unsupported operations', function () {
      const shouldBeUnsupported =
        (promise, done) =>
          promise
            .then(r => done(`Unsupported operation succeeded unexpectedly: ${r}`))
            .catch(err => {
              expect(err).to.equal('operation not supported');
              done();
            });

      it('should not support drop table', done => {
        shouldBeUnsupported(driver.dropTable('Whatever'), done);
      });

      it('should not support dropOttomanModel', done => {
        shouldBeUnsupported(driver.dropOttomanModel('Whatever'), done);
      });

      it('should not support renaming models', done => {
        shouldBeUnsupported(driver.renameOttomanModel('TestModel', 'OtherModel'), done);
      });

      it('should not support inserting', done => {
        shouldBeUnsupported(driver.insert('Whatever', ['a'], [1]), done);
      });

      it('should not support changing columns', done => {
        shouldBeUnsupported(driver.changeColumn('Whatever', 'orig', {}), done);
      });

      it('should not support renaming tables', done => {
        shouldBeUnsupported(driver.renameTable('TestModel', 'OtherModel'), done);
      });
    });

    describe('Models', function () {
      it('should create a model', done => {
        driver.createOttomanModel('Foo', {
          name: 'string',
        }, {})
          .then(model => {
            expect(model).to.be.ok;
            expect(model.schema).to.be.ok;
            done();
          })
          .catch(err => done(err));
      });

      it('should be able to remember models', done => {
        let m = null;

        driver.createOttomanModel('RememberMe', {
          foo: 'string',
        })
          .then(model => {
            m = model;

            return driver.getModel('RememberMe');
          })
          .then(rememberedModel => {
            expect(rememberedModel).to.equal(m);
            done();
          })
          .catch(err => done(err));
      });
    });

    describe('Types', function () {
      let m = null;

      before(done => {
        const model = driver.createTable('TypeTest', {
          changeMeToNum: 'string',
          changeMeToStr: 'boolean',
          changeMeToBool: 'number',
          changeStrToBool: 'string',
        })
          .then(model => {
            m = model;

            const inst = new model({
              changeMeToNum: '500',
              changeMeToStr: true,
              changeMeToBool: 0,
              changeStrToBool: '',
            })

            return new Promise((resolve, reject) => {
              return inst.save(err => {
                if (err) { return reject(err); }
                return resolve(inst);
              });
            });
          })
          .then(() => {
            done();
          })
      });

      it('shouldn\'t convert bad types', done => {
        driver.changeType('TypeTest', 'changeMeToNum', 'blark', 'blork')
          .then(r => done('Converted bad type'))
          .catch(() => done());
      });

      it('shouldn\'t convert unsupported types', done => {
        driver.changeType('TypeTest', 'changeMeToNum', 'Date', 'boolean')
          .then(r => done('Converted bad type pair'))
          .catch(() => done());
      });

      const changeTest = (field, fromT, toT, done) => {
        driver.changeType('TypeTest', field, fromT, toT)
          .then(() => {
            return driver.runN1ql(`SELECT TYPE(${field}) AS t
              FROM \`${config.migrationBucket}\`
              WHERE _type='TypeTest'`);
          })
          .then(r => {
            console.log(JSON.stringify(r));
            expect(r.rows.length).to.be.above(0);

            r.rows.forEach(item => {
              expect(item.t).to.equal(toT);
            });

            done();
          })
          .catch(err => {
            console.error('Failed type test: ' + err);
            done(err);
          });
      };

      it('should change strings to booleans', done => {
        changeTest('changeStrToBool', 'string', 'boolean', done);
      });

      it('should change strings to numbers', done => {
        changeTest('changeMeToNum', 'string', 'number', done);
      });

      it('should change booleans to strings', done => {
        changeTest('changeMeToStr', 'boolean', 'string', done);
      });

      it('should change numbers to booleans', done => {
        changeTest('changeMeToBool', 'number', 'boolean', done);
      })
    });

    describe('Buckets', function () {
      it('should be able to create and remove a bucket', done => {
        driver.createBucket('tmpTest')
          .then(bucket => {
            expect(bucket).to.be.an('object');
            expect(bucket._name).to.equal('tmpTest');

            return driver.getBucketNames();
          })
          .then(buckets => {
            const bucketNames = buckets.map(i => i.name);
            console.log(JSON.stringify(bucketNames));
            expect(bucketNames.indexOf('tmpTest')).to.be.above(-1);
            return driver.dropBucket('tmpTest');
          })
          .then(didDrop => {
            expect(didDrop).to.be.true;
            return driver.getBucketNames();
          })
          .then(buckets => {
            const bucketNames = buckets.map(i => i.name);
            expect(bucketNames.indexOf('tmpTest')).to.be.below(0);
            done();
          })
          .catch(err => done(err));
      });

      it('should expose working withBucket', done => {
        driver.withBucket('default')
          .then(() => done())
          .catch(err => done(err));
      });

      it('should reject promise on bad bucket', done => {
        driver.withBucket('blizzlenert-non-existant')
          .then(() => done(new Error('WTF, that bucket doesn\'t exist')))
          .catch(() => done());
      });

      it('should be able to list buckets', done => {
        driver.getBucketNames()
          .then(buckets => {
            expect(buckets).to.be.an('array');
            expect(buckets.length).to.be.above(0);
            done();
          })
          .catch(err => done(err));
      });
    });

    describe('Compatibility', function () {
      it('all is a synonym for runN1ql', done => {
        driver.all('SELECT * FROM system:indexes')
          .then(results => {
            expect(results.rows).to.be.an('array');
            expect(results.meta).to.be.an('object');
            done();
          })
          .catch(err => done(err));
      });

      it('runSql is a synonym for runN1ql', done => {
        driver.runSql('SELECT * FROM system:indexes')
          .then(results => {
            expect(results.rows).to.be.an('array');
            expect(results.meta).to.be.an('object');
            done();
          })
          .catch(err => done(err));
      });

      it('fails on bad n1ql', done => {
        driver.runN1ql('Blizzle-nert, this is not good n1ql')
          .then(result => {
            return done(`WTF: how did it run that??? ${result}`);
          })
          .catch(err => done());
      });
    });

    describe('Paths', function () {
      const FooMaticSchema = {
        name: 'string',
        foo: 'boolean',
        subDoc: {
          x: 'string',
        },
      };
      const FooMaticInstance = {
        name: 'John',
        foo: true,
        subDoc: {
          x: 'Hi',
        },
      };

      const scenarios = [
        { name: 'simple path', attr: 'likesPie', modelName: 'FooMatic' },
        { name: 'compound path', attr: 'subDoc.somethingElse', modelName: 'FooMatic2' },
      ];

      scenarios.forEach(scenario => {
        it(`should add and remove an ottoman ${scenario.name}`, done => {
          let m = null;

          driver.createTable(scenario.modelName, FooMaticSchema)
            .then(model => {
              m = model;

              const inst = new m(FooMaticInstance);

              return new Promise((resolve, reject) => {
                return inst.save(err => {
                  if (err) { return reject(err); }
                  return resolve(inst);
                });
              });
            })
            .then(() => driver.addOttomanPath(scenario.modelName, scenario.attr))
            .then(() => driver.runN1ql(`SELECT count(*) as x FROM \`${driver.activeBucketName()}\`
                                    WHERE _type='${scenario.modelName}' and ${scenario.attr} IS NOT MISSING`))
            .then(results => {
              console.log(JSON.stringify(results));
              expect(results.rows[0].x).to.be.above(0);
              return driver.removeOttomanPath(scenario.modelName, scenario.attr);
            })
            .then(() => driver.runN1ql(`SELECT count(*) as x FROM \`${config.migrationBucket}\`
                                    WHERE _type='${scenario.modelName}' and ${scenario.attr} IS NOT MISSING`))
            .then(results => {
              console.log(JSON.stringify(results));
              expect(results.rows[0].x).to.equal(0);
              done();
            })
            .catch(err => done(err));
        });
      });

      it('should rename an ottoman path', done => {
        let m = null;

        driver.createTable('RenamePathTest', {
          name: 'string',
          oldName: 'string',
        })
          .then(model => {
            m = model;
            const inst = new m({ name: 'John', oldName: 'something' });

            return new Promise((resolve, reject) => {
              return inst.save(err => {
                if (err) { return reject(err); }
                return resolve(inst);
              });
            });
          })
          .then(() => driver.renameOttomanPath('RenamePathTest', 'oldName', 'newName'))
          .then(() => driver.runN1ql(`SELECT count(*) as x FROM ${config.migrationBucket}
                                    WHERE _type='RenamePathTest' AND oldName IS MISSING AND
                                    newName IS NOT MISSING`))
          .then(results => {
            expect(results.rows[0].x).to.be.above(0);
            done();
          })
          .catch(err => done(err));
      });
    });

    describe('Indexes', function () {
      it('should add and remove an index', done => {
        let m = null;

        const indexExists = (name) => driver.getIndexes()
          .then(results => {
            let found = false;

            for (var i = 0; i < results.rows.length; i++) {
              const z = results.rows[i];
              if (z.indexes.name === name) {
                found = true;
              }
            }

            return found;
          });

        driver.createTable('Test', {
          name: 'string',
          favoriteAnimal: 'string',
        })
          .then(model => {
            m = model;
            return driver.addIndex('Test', 'Test_favoriteAnimalsIdx', 'favoriteAnimal')
          })
          .then(() => indexExists('Test_favoriteAnimalsIdx'))
          .then(exists => {
            expect(exists).to.be.true;
            return driver.removeIndex('Test_favoriteAnimalsIdx');
          })
          .then(() => indexExists('Test_favoriteAnimalsIdx'))
          .then(exists => {
            expect(exists).to.be.false;
            done();
          })
          .catch(err => done(err));
      });
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
});
