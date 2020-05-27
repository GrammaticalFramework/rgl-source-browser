#!/usr/bin/env bash

set -e
docker build --tag rgl-source-browser .
if [ "$1" = 'dev' ] || [ "$1" = '--dev' ]; then
  ARGS="\
--volume $PWD/index.html:/opt/rgl-source-browser/index.html \
--volume $PWD/app.js:/opt/rgl-source-browser/app.js \
--volume $PWD/app.css:/opt/rgl-source-browser/app.css \
--volume $PWD/build-tags.sh:/opt/rgl-source-browser/build-tags.sh \
"
fi
docker run \
  --interactive \
  --tty \
  --rm \
  --publish 5000:5000 \
  ${ARGS} \
  --name rgl-source-browser \
  rgl-source-browser
