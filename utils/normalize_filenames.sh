#!/bin/bash

# Function to recursively rename directories and files
normalize() {
    local dir_path="$1"
    local dry_run="$2"

    for entry in "$dir_path"/*; do
        if [ -d "$entry" ]; then
            # Normalize directory names
            local dir=$(basename "$entry")
            local new_dir=$(echo "$dir" | tr '[:upper:]' '[:lower:]' | tr -d ' ')
            if [ "$dir" != "$new_dir" ]; then
                if [ "$dry_run" = true ]; then
                    echo "DRY RUN: Would rename directory: '$entry' to '$dir_path/$new_dir'"
                else
                    mv "$entry" "$dir_path/$new_dir"
                    entry="$dir_path/$new_dir"
                fi
            fi
            # Recurse into the directory
            normalize "$entry" "$dry_run"
        elif [ -f "$entry" ]; then
            # Normalize file names
            local file=$(basename "$entry")
            local new_file=$(echo "$file" | tr '[:upper:]' '[:lower:]' | tr -d ' ')
            if [ "$file" != "$new_file" ]; then
                if [ "$dry_run" = true ]; then
                    echo "DRY RUN: Would rename file: '$entry' to '$dir_path/$new_file'"
                else
                    mv "$entry" "$dir_path/$new_file"
                fi
            fi
        fi
    done
}

# Start normalization from the given directory or current directory
start_dir=${1:-.}
dry_run=${2:-false}

if [ "$dry_run" = true ]; then
    echo "Performing dry run. No files or directories will be renamed."
fi

normalize "$start_dir" "$dry_run"

if [ "$dry_run" = false ]; then
    echo "Filenames and directories normalized successfully."
else
    echo "Dry run completed. No changes were made."
fi
