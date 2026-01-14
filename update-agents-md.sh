#!/bin/bash

# script for local development testing, imitating an "npx update-agents-md" call
exec node dist/index.js "$@"
