#!/bin/bash

docker run --name couchtest -p 8090-8099:8090-8099 -p 9110:9110 -p 11210:11210 -p 18091:18091 -p 18092:18092 -t mdavidallen/couchbase:latest -d & 

