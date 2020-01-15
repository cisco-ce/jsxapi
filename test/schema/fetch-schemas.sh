#!/usr/bin/env bash

set -e

if [ "$#" -lt 1 ]; then
    echo "usage: fetch-schemas hostname" >&2
    exit 1
fi

get_schema() {
    # "xpref outputmode json" - to avoid printing "OK" at the end
    # "xpref accessmode internal" - because xdoc is internal
    # piping to sed drops all lines until the opening "{" - skip welcome text
    ssh "$1" <<EOF | sed -n '/{/,$p'
xpref outputmode json
xpref accessmode internal
xdoc path: "$2" schema: true format: json
EOF
}

for doc in command config status; do
    echo "Fetching '$doc'"
    get_schema "$1" "$doc" > "$doc.json"
done
