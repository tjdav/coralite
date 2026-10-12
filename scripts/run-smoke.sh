#!/bin/sh
set -e
cd "$(dirname "$0")/.."

files=$(grep -v '^#' scripts/smoke-tests.txt | grep -v '^$' | tr '\n' ' ')

exec node --conditions=development --experimental-vm-modules --experimental-import-meta-resolve \
  --test --test-timeout=30000 --test-concurrency=4 --max-old-space-size=2048 \
  $files
