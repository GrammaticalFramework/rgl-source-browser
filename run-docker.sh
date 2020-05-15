#!/usr/bin/env bash

set -e
docker build --tag rgl-source-browser .
docker run --interactive --tty --rm --publish 41292:5000 rgl-source-browser
