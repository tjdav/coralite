#! /bin/bash

# Create changelog file header
cat > changelog.md << EOF
# 🎁 Complete Release History

EOF

# Get all tags sorted by date (newest first)
ALL_TAGS=$(git tag --sort=-committerdate)

# Initialize variables for tracking
TOTAL_COMMIT_COUNT=0
PREVIOUS_TAG=""
FIRST_ITERATION=true

# Process each tag
while read -r current_tag; do
  # Skip if this is the first iteration (newest tag)
  if $FIRST_ITERATION; then
    PREVIOUS_TAG=$current_tag
    FIRST_ITERATION=false
    continue
  fi
  
  # Add section for this version
  echo "## Release: \`$PREVIOUS_TAG\`" >> changelog.md
  echo "" >> changelog.md
  echo "### Changes from \`$current_tag\` to \`$PREVIOUS_TAG\`" >> changelog.md
  echo "" >> changelog.md
  
  # Get commit hashes between these tags
  git log --pretty=format:"%H" $current_tag..$PREVIOUS_TAG > temp_commit_hashes.txt
  
  # Count commits for this release
  COMMIT_COUNT=$(wc -l < temp_commit_hashes.txt)
  TOTAL_COMMIT_COUNT=$((TOTAL_COMMIT_COUNT + COMMIT_COUNT))
  
  # Process each commit
  while read -r commit_hash; do
    # Get commit details
    commit_subject=$(git show -s --format="- %h%d %s - (*%an*)" $commit_hash)
    commit_body=$(git show -s --format="%b" $commit_hash)
    
    # Append to changelog file
    echo "$commit_subject" >> changelog.md
    
    # Only append body if it's not empty (add indentation for readability)
    if [ ! -z "$commit_body" ]; then
      echo "$commit_body" | sed 's/^/    /' >> changelog.md
      echo "" >> changelog.md
    fi
  done < temp_commit_hashes.txt
  
  # Add metadata for this version
  cat >> changelog.md << EOF

### Metadata
\`\`\`
This version -------- $PREVIOUS_TAG
Previous version ---- $current_tag
Total commits ------- $COMMIT_COUNT
\`\`\`

EOF

  # Update previous tag to current tag for next iteration
  PREVIOUS_TAG=$current_tag
  
done <<< "$ALL_TAGS"

# For the first release (commits before the earliest tag)
if [ ! -z "$PREVIOUS_TAG" ]; then
  EARLIEST_TAG=$PREVIOUS_TAG
  
  echo "## Initial Release: \`$EARLIEST_TAG\`" >> changelog.md
  echo "" >> changelog.md
  echo "### Initial Commits" >> changelog.md
  echo "" >> changelog.md
  
  # Get commit hashes for the first release
  git log --pretty=format:"%H" $EARLIEST_TAG > temp_commit_hashes.txt
  
  # Count commits for initial release
  COMMIT_COUNT=$(wc -l < temp_commit_hashes.txt)
  TOTAL_COMMIT_COUNT=$((TOTAL_COMMIT_COUNT + COMMIT_COUNT))
  
  # Process each commit
  while read -r commit_hash; do
    # Get commit details
    commit_subject=$(git show -s --format="- %h%d %s - (*%an*)" $commit_hash)
    commit_body=$(git show -s --format="%b" $commit_hash)
    
    # Append to changelog file
    echo "$commit_subject" >> changelog.md
    
    # Only append body if it's not empty (add indentation for readability)
    if [ ! -z "$commit_body" ]; then
      echo "$commit_body" | sed 's/^/    /' >> changelog.md
      echo "" >> changelog.md
    fi
  done < temp_commit_hashes.txt
  
  # Add metadata for initial release
  cat >> changelog.md << EOF

### Metadata
\`\`\`
First version ------- $EARLIEST_TAG
Total commits ------- $COMMIT_COUNT
\`\`\`

EOF
fi

# Add overall summary
cat >> changelog.md << EOF
## Summary
\`\`\`
Total releases ------ $(echo "$ALL_TAGS" | wc -l)
Total commits ------- $TOTAL_COMMIT_COUNT
\`\`\`
EOF

# Clean up
rm -f temp_commit_hashes.txt

echo "Complete changelog has been generated as changelog.md"