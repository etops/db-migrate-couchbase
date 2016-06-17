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

## Return Types

Like other db-migrate plugins, all functions in this plugin can be used either with callback syntax,
or as promises.  

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

### Change a path from a model

Supported.

### Add/Remove an Index

Supported.

### Create / delete a bucket

Supported.

