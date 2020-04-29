#!/usr/bin/env bash

set -e

if [ "$#" -lt 1 ]; then
    echo "usage: fetch-schemas hostname [format]" >&2
    echo "  format: 'json' (default) or 'xml'" >&2
    exit 1
fi

fmt=${2:-json}

get_schema() {
    # "xpref outputmode json" - to avoid printing "OK" at the end
    # "xpref accessmode internal" - because xdoc is internal
    # piping to sed drops all lines until the first "OK" - skip welcome text
    ssh -T "$1" <<EOF | sed -n '/^OK$/,$p' | tail +3
xpref outputmode "$fmt"
xpref accessmode internal
xdoc Path: "$2" Schema: true Format: "$fmt"
EOF
}

for doc in command config status; do
    echo "Fetching '$doc.$fmt'"
    get_schema "$1" "$doc" > "$doc.$fmt"
done
