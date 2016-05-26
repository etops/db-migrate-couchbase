#!/bin/bash

docker run --name couchtest -p 8090-8099:8090-8099 -t couchtest -d & 

