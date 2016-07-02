# db-migrate-couchbase

[![CircleCI](https://circleci.com/gh/etops/db-migrate-couchbase.svg?style=shield&circle-token=97aa45b12244350e6fb856c5689884899fc6dd29)](https://circleci.com/gh/etops/db-migrate-couchbase)

Basics of a driver for couchbase data migrations.  This driver is intended for use with 
[db-migrate](https://db-migrate.readthedocs.io/en/latest/search/).

Couchbase is a NoSQL database that uses concepts of buckets and documents, rather than tables, databases,
or collections as in MongoDB.

Couchbase does support an SQL like language called N1QL which can be used to accomplish many of the same 
migration actions as would be performed in SQL.

The focus of this driver is to enable N1QL data migrations in couchbase, with a particular focus on 
facilitating migration of [Ottoman](https://github.com/couchbaselabs/node-ottoman) data models.

## Local Development

1. `npm install` 
2. `npm install -g db-migrate`

`gulp compile` is used to transpile es6 to javascript which is then run from the `dist` folder.

Locally, `npm link` is used to install a copy of db-migrate-couchbase into its own node_modules folder,
so that you can run `db-migrate` and have it pick up the plugin.  This is accomplished with the comamnds
`npm link .` and `npm link db-migrate-couchbase`.

Because db-migrate will use the regular javascript and not the es6, in general you will need to run
`gulp compile` before changes are picked up.

## Conventions

The db-migrate package was really written for relational databases, but Couchbase isn't relational.
This necessitates we have a few conventions about which concepts db-migrate uses, and what they mean
to couchbase.

1. A database is equivalent to a Couchbase bucket.
2. A table is an Ottoman model.  For example, Customer(lastName, firstName)
3. A row is an Ottoman model instance, for example (Smith, John)
4. A column is a path into an ottoman model, e.g. "address.state"

With these conventions in mind, the driver implements the same functionality as required by db-migrate,
but with a few extra functions as well to provide features like opening/creating buckets.

In some cases, certain features in db-migrate have no analogue in couchbase, such as foreign keys.
In those cases, certain methods are no implemented.

## Ottoman Specific

Because Couchbase has no concept of "tables" or structured data per se, this plugin does expect
and require the use of Ottoman for many migrations.  Plenty of methods can be used without ottoman
(for example running n1ql queries) but to create the migration records in the database, the plugin
uses Ottoman - and to perform certain operations (like changing columns/paths) it is assumed those
operations are performed on ottoman model instances.

## Configuration

To use this driver, create a `database.json` file with information similar to the following:

```
{
  "defaultEnv": "dev",
  "dev": {
    "driver": "couchbase",
    "user": "admin",
    "password": "admin",
    "bucket": "default",
    "migrationBucket": "default"
  },
  "couchbase": {
    "driver": "couchbase",
    "bucket": "default",
    "migrationBucket": "default",    
    "host": {"ENV": "COUCHBASE_HOST"}
  }
}
```

## Example Migration

New migrations can be created with the `db-migrate` tool, via `db-migrate new`.  This will create a 
`migrations` folder and put your first migration into it, which you then have to customize.

In the example below, we use the SQL style syntax that's more familiar for db-migrate.  In all cases
with this driver, SQL is an alias for n1ql querying, and "columns" refer to ottoman paths.

Like other db-migrate plugins, all functions in this plugin can be used either with callback syntax,
or as promises.  So you can use them either way; this example however uses the promise style.

```
'use strict';

var dbm;
var type;
var seed;

/**
  * We receive the dbmigrate dependency from dbmigrate initially.
  * This enables us to not have to rely on NODE_PATH.
  */
exports.setup = function (options, seedLink) {
  console.log('FIRST MIGRATION');
  console.log(JSON.stringify(options));
  console.log(JSON.stringify(seedLink));
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = function (db) {
  console.log('FIRST MIGRATE: UP');

  return db
    .addColumn('Test', 'newAttribute', { type: 'string' })
    .then(() => db.runSql('UPDATE default SET newAttribute=\'FOO\' WHERE _type=\'Test\''))
    .then(() => db.renameColumn('Test', 'renameMe', 'renamedColumn'))
    .then(() => db.removeColumn('Test', 'removeMe'))
    .then(() => console.log('FIRST MIGRATE: UP (done)'));
};

exports.down = function (db) {
  console.log('FIRST MIGRATE: DOWN');

  return db
    .removeColumn('Test', 'newAttribute')
    .then(() => db.addColumn('Test', 'removeMe', { type: 'string ' }))
    .then(() => db.renameColumn('Test', 'renamed', 'renameMe'))
    .then(() => console.log('FIRST MIGRATE: DOWN (done)'));
};
```

## Additional Warnings / Gotchas

### Keep Indexes in Mind

When changing or removing a column/ottoman path, remember to keep indexes in mind.  It is possible to remove
a path (which has the effect of `UNSET`ing the field in couchbase) and retain the index.  But that is probably
not a useful thing to do, so you may want to pair usage of change/remove column with `removeIndex`.

### Watch the size of your updates

Some users of couchbase have reported that when updating extremely large data sets, couchbase can run out
of memory and fail to update properly.  This migration driver generally tries to update things in one single
query without "batching".  Make sure your server instance has enough memory to perform the updates you're 
trying to accomplish in your migration.

### No transactions

As of Couchbase 4.5.0, transactions are not supported, so they're not supported by this driver either.
This means that it is a general good practice to take a backup or database snapshot before performing a big
database migration, in case things go wrong.

## Breaking Down Migrations

There are a few use cases of migrations you'd want to run.  This is an attempt to enumerate them, and
describe how they would work.

### Add a model/table

Unsupported.  In Couchbase/Ottoman, the way you do this is by defining an Ottoman model in code, and then
ensuring that the keys are supported on the server.  This does not need implementation by this driver.

### Remove a model/table

Not yet supported; in Couchbase terms this would mean deleting all documents in a bucket of a particular
ottoman type.  Because this is straightforward to do with n1ql, may leave this to the user to do if they
want to.

### Add a path to a model

Supported.

### Remove a path from a model

Supported.

### Change a field type (i.e. from string to number)

Supported.

### Change a path from a model

Supported.

### Add/Remove an Index

Supported.

### Create / delete a bucket

Supported.

