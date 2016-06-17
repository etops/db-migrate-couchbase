/**
 * Test script for STATE 1 of data migration testing.
 * Create a simple model, jam a lot of data in.
 */
import ottoman from 'ottoman';
import connection from './connection';
import randomstring from 'randomstring';
import Promise from 'bluebird';

ottoman.bucket = connection.bucket;

const Model = ottoman.model('Test', {
  oid: { type: 'string', auto: 'uuid', readonly: true },
  number: { type: 'number' },
  name: { type: 'string' },
  renameMe: { type: 'string' },
  removeMe: { type: 'string' },
},
  {
    id: 'oid',
    index: {
      findByOid: {
        by: 'oid',
        type: 'n1ql',
      },
    },
  });

const promises = [];

ottoman.ensureIndices(err => {
  if (err) {
    console.error(`Failed to create ottoman indices: ${err}`);
    throw new Error('Nope.');
  }

  for (let i = 0; i < 100; i++) {
    const number = Math.random();
    const name = randomstring.generate({ length: 12, charset: 'alphabetic', });
    const renameMe = randomstring.generate({ length: 12, charset: 'alphabetic' });
    const removeMe = randomstring.generate({ length: 12, charset: 'alphabetic' });

    promises.push(new Promise((resolve, reject) => {
      new Model({ name, number, renameMe, removeMe }).save(err2 => {
        if (err2) { return reject(err2); }
        console.log('Saving record...');
        return resolve(true);
      });
    }));
  }

  return Promise.all(promises)
    .then(() => setTimeout(() => process.exit(0), 1000))
    .catch(err2 => {
      console.error(`Failed to insert records: ${err2}`);
      setTimeout(() => process.exit(1), 1000);
    });
});
