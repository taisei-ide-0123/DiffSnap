#!/bin/bash

# DiffSnap - Build Size Check Script
# Checks the size of build artifacts and warns if they exceed thresholds

set -e

# Color codes for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Size thresholds (in KB)
MAX_CONTENT_SCRIPT_SIZE=100  # Content script should be lightweight
MAX_BACKGROUND_SIZE=200      # Background service worker
MAX_POPUP_SIZE=150          # Popup UI
MAX_SETTINGS_SIZE=150       # Settings UI
MAX_TOTAL_SIZE=1024         # Total extension size (1MB)

echo "🔍 Checking build artifact sizes..."
echo ""

# Check if dist directory exists
if [ ! -d "dist" ]; then
  echo -e "${RED}❌ Error: dist directory not found. Run 'pnpm build' first.${NC}"
  exit 1
fi

# Function to get file size in KB
get_size_kb() {
  if [ -f "$1" ]; then
    du -k "$1" | cut -f1
  else
    echo "0"
  fi
}

# Function to check size against threshold
check_size() {
  local file_path="$1"
  local threshold="$2"
  local name="$3"

  if [ ! -f "$file_path" ]; then
    echo -e "${YELLOW}⚠️  $name not found at $file_path${NC}"
    return 0
  fi

  local size=$(get_size_kb "$file_path")
  local size_mb=$(echo "scale=2; $size/1024" | bc)

  if [ "$size" -gt "$threshold" ]; then
    echo -e "${RED}❌ $name: ${size}KB (${size_mb}MB) - exceeds ${threshold}KB threshold${NC}"
    return 1
  else
    echo -e "${GREEN}✅ $name: ${size}KB (${size_mb}MB)${NC}"
    return 0
  fi
}

# Check individual files
has_error=0

check_size "dist/content/index.js" "$MAX_CONTENT_SCRIPT_SIZE" "Content Script" || has_error=1
check_size "dist/background/index.js" "$MAX_BACKGROUND_SIZE" "Background Script" || has_error=1
check_size "dist/popup/index.js" "$MAX_POPUP_SIZE" "Popup Script" || has_error=1
check_size "dist/settings/index.js" "$MAX_SETTINGS_SIZE" "Settings Script" || has_error=1

# Check total size
echo ""
echo "📦 Checking total extension size..."
total_size=$(du -sk dist | cut -f1)
total_size_mb=$(echo "scale=2; $total_size/1024" | bc)

if [ "$total_size" -gt "$MAX_TOTAL_SIZE" ]; then
  echo -e "${RED}❌ Total size: ${total_size}KB (${total_size_mb}MB) - exceeds ${MAX_TOTAL_SIZE}KB (1MB) threshold${NC}"
  has_error=1
else
  echo -e "${GREEN}✅ Total size: ${total_size}KB (${total_size_mb}MB)${NC}"
fi

# List largest files
echo ""
echo "📊 Top 10 largest files:"
find dist -type f -exec du -k {} \; | sort -rn | head -10 | while read size file; do
  size_mb=$(echo "scale=2; $size/1024" | bc)
  echo "  ${size}KB (${size_mb}MB) - $file"
done

echo ""
if [ "$has_error" -eq 1 ]; then
  echo -e "${RED}❌ Size check failed. Consider optimizing bundle size.${NC}"
  exit 1
else
  echo -e "${GREEN}✅ All size checks passed!${NC}"
fi
