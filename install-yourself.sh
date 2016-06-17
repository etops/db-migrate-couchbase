#!/bin/sh
gulp compile
TARGET=node_modules/db-migrate-couchbase
mkdir /tmp/db-migrate-couchbase
echo "Copying..."
cp -r node_modules dist *.json /tmp/db-migrate-couchbase
echo "Removing old..."
rm -rf $TARGET
echo "Staging..."
mkdir -p $TARGET
mv /tmp/db-migrate-couchbase $TARGET
