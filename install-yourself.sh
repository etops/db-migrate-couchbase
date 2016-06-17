#!/bin/sh
TARGET=node_modules/db-migrate-couchbase
mkdir /tmp/db-migrate-couchbase
cp -r * /tmp/db-migrate-couchbase
rm -rf $TARGET
mv /tmp/db-migrate-couchbase $TARGET
mkdir -p $TARGET
