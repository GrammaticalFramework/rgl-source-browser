#!/bin/bash
#
# Script for building tags files for all RGL
# Path to RGL repository must be provided via GF_RGL
# John J. Camilleri, 2018

datadir="data"
tagsdir="${datadir}/tags"
srcdir="${datadir}/src"
module_index="${datadir}/index.json"
module_index_tmp="${module_index}.tmp"
search_index="${datadir}/search.json"
search_index_tmp="${search_index}.tmp"
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
        echo "You must specify the OS variable to be one of: bsd, mac, gnu, linux"
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
    echo "You must specify the GF_RGL variable, pointing to the path of the gf-rgl repository"
    exit 1
fi

# Make path absolute if relative
GF_RGL=$(cd "$GF_RGL" || exit ; pwd)

# Look for gf-rgl/src
basedir="${GF_RGL%/}/src"
if [ ! -d "$basedir" ] ; then
    echo "Cannot find directory ${basedir}"
    exit 1
fi

# Make the dirs just to be sure
mkdir -p "$datadir"
mkdir -p "$tagsdir"
mkdir -p "$srcdir"

# Iterate and build all the tags
build_tags() {
    echo "Copying sources..."
    for fulldir in "$basedir"/*
    do
        dir=$(basename "$fulldir")
        if ! in_ignore "$dir" && [ -d "$fulldir" ] ; then
            mkdir -p "${srcdir}/${dir}"
            cp -r "$fulldir"/*.gf "${srcdir}/${dir}/"
        fi
    done

    echo "Building tags..."
    rm -f "$module_index_tmp"
    printf "{\n" >> "$module_index_tmp"
    # printf "  \"urlprefix\": \"/\",\n" >> "$module_index_tmp"
    printf "  \"tags_path\": \"%s\",\n" "$tagsdir" >> "$module_index_tmp"
    printf "  \"src_path\": \"%s\",\n" "$srcdir" >> "$module_index_tmp"
    gitsha=$(cd "$basedir" || exit ; git rev-parse --verify HEAD)
    printf "  \"commit\": \"%s\",\n" "$gitsha" >> "$module_index_tmp"
    printf "  \"languages\": {\n" >> "$module_index_tmp"
    y=0
    successes=0
    failures=0
    for fulldir in "$basedir"/*
    do
        dir=$(basename "$fulldir")
        if ! in_ignore "$dir" && [ -d "$fulldir" ] ; then
            # mkdir -p "${srcdir}/${dir}"
            # cp -r "$fulldir"/*.gf "${srcdir}/${dir}/"
            if ((y > 0)); then printf ",\n" >> "$module_index_tmp" ; fi
            printf "    \"%s\": [\n" "$dir" >> "$module_index_tmp"
            x=0
            for fullfile in "$fulldir"/*.gf
            do
                file=$(basename "$fullfile")
                echo "$dir/$file"
                if ((x > 0)); then printf ",\n" >> "$module_index_tmp" ; fi
                printf "      \"%s\"" "$(echo "$file" | sed 's|./||;s|.gf||')" >> "$module_index_tmp"
                filemtime=$($STAT "${tagsdir}/${file}-tags" 2>/dev/null)
                if [ -z "$filemtime" ] || [ "$filemtime" -lt "$start" ] ; then
                    if gf --path="${srcdir}/*" --batch --quiet --tags --output-dir="$tagsdir" "$fullfile" ; then
                        ((successes+=1))
                    else
                        ((failures+=1))
                    fi
                fi
                ((x+=1))
            done
            printf "\n    ]" >> "$module_index_tmp"
            ((y+=1))
        fi
    done
    printf "\n  }\n}\n" >> "$module_index_tmp"
    mv "$module_index_tmp" "$module_index"
    total=$((successes + failures))
    tagstotal=$(ls ${tagsdir}/*.gf-tags | wc -l)
    echo "Finished building tags:"
    echo "  ${successes} ok"
    echo "  ${failures} failed"
    echo "  ${total} processed total"
    echo "  ${tagstotal} tag files generated"
}

# Replace all paths
replace_paths() {
    echo "Replacing paths..."
    # Z:/Users/john/repositories/gf-rgl/src
    fakewindir="Z:${basedir}"
    sed -i.bak -e "s!${basedir}/!!" -e "s!${tagsdir}/!!" -e 's!\\!/!g' -e "s!${fakewindir}/!!" "$tagsdir"/*.gf-tags
    rm -f "$tagsdir"/*.gf-tags.bak
}

# Build search index
build_index() {
    echo "Building search index..."
    rm -f "$search_index_tmp"
    printf "[\n" >> "$search_index_tmp"
    prev_symbol=
    # Only consider modules without Dict in the name.
    # TODO not safe for filenames containing whitespce, probably need to use find instead
    files=$(ls "$tagsdir"/*.gf-tags | grep -v Dict)
    cat $files | awk -F '\t' '{ if ($2 != "indir") { print $1"\t"$2"\t"$3"\t"$4 } }' | sort -u | while read symbol jtype location ftype ; do
        if [ "$symbol" != "$prev_symbol"  ] ; then
            if [ "$prev_symbol" != ""  ] ; then
                # End previous
                printf "\n    ]\n  },\n" >> "$search_index_tmp"
            fi
            # Start new
            printf "  {\n    \"symbol\": \"%s\",\n    \"hits\": [\n" "$symbol" >> "$search_index_tmp"
            prev_symbol="$symbol"
            x=0
        fi
        if ((x > 0)); then printf ",\n" >> "$search_index_tmp" ; fi

        # Append location and type info
        printf "      { \"jtype\": \"%s\", \"location\": \"%s\", \"ftype\": \"%s\" }" "$jtype" "$location" "$ftype" >> "$search_index_tmp"
        # printf "      { \"type\": \"%s\", \"location\": \"%s\"" "$jtype" "$location" >> "$search_index_tmp"
        # if [ ! -z "$ftype" ] ; then
        #     printf ", \"ftype\": \"%s\" }" "$ftype" >> "$search_index_tmp"
        # else
        #     printf " }" >> "$search_index_tmp"
        # fi
        ((x+=1))
    done
    printf "    ]\n  }\n]" >> "$search_index_tmp"
    mv "$search_index_tmp" "$search_index"
}

# --- Main code ----

build_tags
replace_paths
build_index
