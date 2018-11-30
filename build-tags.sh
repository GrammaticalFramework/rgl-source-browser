#!/bin/bash
#
# Script for building tags files for all RGL
# Path to RGL repository must be provided via GF_RGL
# John J. Camilleri, 2018

datadir="data"
tagsdir="${datadir}/tags"
srcdir="${datadir}/src"
index="${datadir}/index.tmp.json"
index_final="${datadir}/index.json"
ignore="demo experimental"
start=$(date +%s)

# Set stat command based on OS

case "$OS" in
    "bsd" | "mac")
        STAT="stat -f %a"
        ;;
    "gnu" | "linux")
        STAT="stat --format=%Y"
        ;;
    *)
        echo "You must speficy the OS variable to be one of: bsd, mac, gnu, linux"
        exit 1
        ;;
esac

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
    echo "You must specify the absolute path to the RGL repository with GF_RGL"
    exit 1
fi
basedir="${GF_RGL%/}/src"
if [ ! -d "$basedir" ] ; then
    echo "Cannot find directory ${basedir}"
    exit 1
fi

# Make the dirs just to be sure
mkdir -p "$datadir"
mkdir -p "$tagsdir"
mkdir -p "$srcdir"

# Iterate and build all the tags (takes some time)
echo "Building tags..."
rm -f "$index"
printf "{\n" >> "$index"
# printf "  \"urlprefix\": \"/\",\n" >> "$index"
printf "  \"tags_path\": \"${tagsdir}\",\n" >> "$index"
printf "  \"src_path\": \"${srcdir}\",\n" >> "$index"
gitsha=$(cd $basedir ; git rev-parse --verify HEAD --short=7)
printf "  \"commit\": \"%s\",\n" "$gitsha" >> "$index"
printf "  \"languages\": {\n" >> "$index"
y=0
for fulldir in "$basedir"/*
do
    dir=$(basename "$fulldir")
    if ! in_ignore "$dir" && [ -d "$fulldir" ] ; then
        echo "$dir"
        mkdir -p "${srcdir}/${dir}"
        cp -r "$fulldir"/*.gf "${srcdir}/${dir}/"
        if ((y > 0)); then printf ",\n" >> "$index" ; fi
        printf "    \"%s\": [\n" "$dir" >> "$index"
        x=0
        for fullfile in "$fulldir"/*.gf
        do
            file=$(basename "$fullfile")
            if ((x > 0)); then printf ",\n" >> "$index" ; fi
            printf "      \"%s\"" "$(echo "$file" | sed 's|./||;s|.gf||')" >> "$index"
            filemtime=$($STAT "${tagsdir}/${file}-tags" 2>/dev/null)
            if [ -z "$filemtime" ] || [ "$filemtime" -lt "$start" ] ; then
                gf --batch --quiet --tags --output-dir="$tagsdir" "$fullfile" 2>/dev/null
            fi
            ((x+=1))
        done
        printf "\n    ]" >> "$index"
        ((y+=1))
    fi
done
printf "\n  }\n}\n" >> "$index"
mv "$index" "$index_final"

# Replace all paths
echo "Replacing paths..."
sed -i.bak "s!${basedir}/!!;s!${tagsdir}/!!;" "$tagsdir"/*.gf-tags
rm -f "$tagsdir"/*.gf-tags.bak

# TODO: renaming of
# AdN	indir	CatAra		Z:\Users\john\repositories\gf-rgl\src\common\CommonX.gf-tags
