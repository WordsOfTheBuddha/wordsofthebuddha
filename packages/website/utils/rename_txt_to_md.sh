#!/bin/bash

# Directory to start the search
start_dir="."

# Find all .txt files and rename them to .md
#find "$start_dir" -type f -name "*en.txt" | while read -r file; do
#    mv "$file" "${file%.txt}.md"
#done

# Find all .en.md files and rename them to .en.mdx
find "$start_dir" -type f -name "*.en.md" | while read -r file; do
    mv "$file" "${file%.en.md}.en.mdx"
done