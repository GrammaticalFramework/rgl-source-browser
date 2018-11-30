#!/bin/bash
#
# Script for building tags files for all RGL
# Path to RGL repository must be provided via GF_RGL
# John J. Camilleri, 2018

tagsdir="data"
index="${tagsdir}/index.json"
ignore="demo old-demo tmp"
start=$(date +%s)

# Commands on GNU linux
# STAT="stat --format=%Y"

# Commands on OSX
STAT="stat -f %a"

# Function for testing array membership
in_ignore() {
    local search="$1"
    for i in $ignore; do
        if [ "$i" = "$search" ]; then
            return 0
        fi
    done
    return 1
}

# Check path to RGL
if [ -z "$GF_RGL" ] ; then
    echo "You must specify the path to the RGL repository, with GF_RGL e.g.:"
    echo "GF_RGL=/Users/john/repositories/gf-rgl"
    exit 1
fi
basedir="${GF_RGL%/}/src"
if [ ! -d "$basedir" ] ; then
    echo "Cannot find directory ${basedir}"
    exit 1
fi

# Make the dir just to be sure
[ -d "$tagsdir" ] || mkdir "$tagsdir"

# Iterate and build all the tags (takes some time)
echo "Building tags..."
rm -f "$index"
printf "{\n  \"urlprefix\": \"/\",\n" >> "$index"
printf "  \"languages\": {\n" >> "$index"
y=0
for fulldir in "$basedir"/*
do
    dir=$(basename "$fulldir")
    if ! in_ignore "$dir" && [ -d "$fulldir" ] ; then
        echo "$fulldir"
        if ((y > 0)); then printf ",\n" >> "$index" ; fi
        printf "    \"%s\": [\n" "$dir" >> "$index"
        x=0
        for fullfile in "$fulldir"/*.gf
        do
            file=$(basename "$fullfile")
            if ((x > 0)); then printf ",\n" >> "$index" ; fi
            printf "      \"%s\"" "$(echo "$file" | sed 's|./||;s|.gf||')" >> "$index"
            filemtime=$($STAT "${tagsdir}/${file}-tags" 2>/dev/null)
            if [ -z "$filemtime" ] || [ "$filemtime" -lt "$start" ]
            then
                gf --batch --quiet --tags --output-dir="$tagsdir" "$fullfile" 2>/dev/null
            fi
            ((x+=1))
        done
        printf "\n    ]" >> "$index"
        ((y+=1))
    fi
done
printf "\n  }\n}\n" >> "$index"

# Replace all paths
echo "Replacing paths..."
sed -i '' "s!${basedir}/!!;s!${tagsdir}/!!;" "$tagsdir"/*.gf-tags
