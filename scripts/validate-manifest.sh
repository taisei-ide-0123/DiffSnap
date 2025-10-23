#!/bin/bash

# DiffSnap - Manifest Validation Script
# Validates manifest.json structure and required fields for Chrome Extension

set -e

# Color codes for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo "🔍 Validating manifest.json..."
echo ""

MANIFEST_PATH="public/manifest.json"
has_error=0

# Check if manifest.json exists
if [ ! -f "$MANIFEST_PATH" ]; then
  echo -e "${RED}❌ Error: manifest.json not found at $MANIFEST_PATH${NC}"
  exit 1
fi

# Function to check if jq is installed
check_jq() {
  if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}⚠️  Warning: jq not found. Installing basic validation only.${NC}"
    return 1
  fi
  return 0
}

# Basic JSON syntax validation
if check_jq; then
  if ! jq empty "$MANIFEST_PATH" 2>/dev/null; then
    echo -e "${RED}❌ Invalid JSON syntax in manifest.json${NC}"
    exit 1
  else
    echo -e "${GREEN}✅ Valid JSON syntax${NC}"
  fi
fi

# Function to validate field exists
validate_field() {
  local field="$1"
  local description="$2"

  if check_jq; then
    local value
    value=$(jq -r "$field" "$MANIFEST_PATH" 2>/dev/null)
    if [ "$value" == "null" ] || [ -z "$value" ]; then
      echo -e "${RED}❌ Missing required field: $description ($field)${NC}"
      return 1
    else
      echo -e "${GREEN}✅ $description: $value${NC}"
      return 0
    fi
  fi
}

# Function to validate field is array
validate_array() {
  local field="$1"
  local description="$2"

  if check_jq; then
    local value
    value=$(jq -r "$field | type" "$MANIFEST_PATH" 2>/dev/null)
    if [ "$value" != "array" ]; then
      echo -e "${RED}❌ $description should be an array ($field)${NC}"
      return 1
    else
      local length
      length=$(jq -r "$field | length" "$MANIFEST_PATH" 2>/dev/null)
      echo -e "${GREEN}✅ $description: array with $length items${NC}"
      return 0
    fi
  fi
}

# Validate required fields for Manifest V3
echo "📋 Checking required fields..."

validate_field ".manifest_version" "Manifest version" || has_error=1
validate_field ".name" "Extension name" || has_error=1
validate_field ".version" "Version" || has_error=1
validate_field ".description" "Description" || has_error=1

# Check manifest version is 3
if check_jq; then
  manifest_version=$(jq -r ".manifest_version" "$MANIFEST_PATH" 2>/dev/null)
  if [ "$manifest_version" != "3" ]; then
    echo -e "${RED}❌ Manifest version must be 3 (found: $manifest_version)${NC}"
    has_error=1
  fi
fi

echo ""
echo "🔐 Checking permissions..."
validate_array ".permissions" "Permissions" || has_error=1

# Check for activeTab permission (required for our use case)
if check_jq; then
  has_active_tab=$(jq -r '.permissions | map(select(. == "activeTab")) | length' "$MANIFEST_PATH" 2>/dev/null)
  if [ "$has_active_tab" == "0" ]; then
    echo -e "${YELLOW}⚠️  Warning: 'activeTab' permission not found${NC}"
  fi
fi

echo ""
echo "🎨 Checking UI components..."
validate_field ".action.default_popup" "Popup page" || has_error=1
validate_field ".options_page" "Options page" || has_error=1

echo ""
echo "⚙️  Checking background service worker..."
validate_field ".background.service_worker" "Service worker" || has_error=1
validate_field ".background.type" "Service worker type" || has_error=1

# Check service worker type is module
if check_jq; then
  sw_type=$(jq -r ".background.type" "$MANIFEST_PATH" 2>/dev/null)
  if [ "$sw_type" != "module" ]; then
    echo -e "${YELLOW}⚠️  Warning: Service worker type should be 'module' (found: $sw_type)${NC}"
  fi
fi

echo ""
echo "📜 Checking content scripts..."
validate_array ".content_scripts" "Content scripts" || has_error=1

# Validate content script structure
if check_jq; then
  cs_count=$(jq -r '.content_scripts | length' "$MANIFEST_PATH" 2>/dev/null)
  if [ "$cs_count" -gt "0" ]; then
    for i in $(seq 0 $((cs_count - 1))); do
      echo "  Content script #$((i + 1)):"

      matches=$(jq -r ".content_scripts[$i].matches | length" "$MANIFEST_PATH" 2>/dev/null)
      js_files=$(jq -r ".content_scripts[$i].js | length" "$MANIFEST_PATH" 2>/dev/null)

      if [ "$matches" == "0" ]; then
        echo -e "    ${RED}❌ No matches defined${NC}"
        has_error=1
      else
        echo -e "    ${GREEN}✅ Matches: $matches patterns${NC}"
      fi

      if [ "$js_files" == "0" ]; then
        echo -e "    ${RED}❌ No JS files defined${NC}"
        has_error=1
      else
        echo -e "    ${GREEN}✅ JS files: $js_files files${NC}"
      fi
    done
  fi
fi

echo ""
echo "🌐 Checking web accessible resources..."
validate_array ".web_accessible_resources" "Web accessible resources" || has_error=1

# Check version format (should be semantic versioning)
if check_jq; then
  version=$(jq -r ".version" "$MANIFEST_PATH" 2>/dev/null)
  if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo -e "${YELLOW}⚠️  Warning: Version should follow semantic versioning (x.y.z)${NC}"
  fi
fi

# Check if referenced files exist in dist (after build)
echo ""
echo "📁 Checking referenced files..."

if [ -d "dist" ]; then
  # Check if popup exists
  if check_jq; then
    popup_path=$(jq -r ".action.default_popup" "$MANIFEST_PATH" 2>/dev/null)
    if [ ! -f "dist/$popup_path" ] && [ "$popup_path" != "null" ]; then
      echo -e "${YELLOW}⚠️  Popup file not found in dist: $popup_path${NC}"
      echo -e "${YELLOW}    (This is OK if you haven't run 'pnpm build' yet)${NC}"
    fi

    # Check if service worker exists
    sw_path=$(jq -r ".background.service_worker" "$MANIFEST_PATH" 2>/dev/null)
    if [ ! -f "dist/$sw_path" ] && [ "$sw_path" != "null" ]; then
      echo -e "${YELLOW}⚠️  Service worker not found in dist: $sw_path${NC}"
      echo -e "${YELLOW}    (This is OK if you haven't run 'pnpm build' yet)${NC}"
    fi

    # Check content scripts
    cs_count=$(jq -r '.content_scripts | length' "$MANIFEST_PATH" 2>/dev/null)
    for i in $(seq 0 $((cs_count - 1))); do
      js_count=$(jq -r ".content_scripts[$i].js | length" "$MANIFEST_PATH" 2>/dev/null)
      for j in $(seq 0 $((js_count - 1))); do
        js_path=$(jq -r ".content_scripts[$i].js[$j]" "$MANIFEST_PATH" 2>/dev/null)
        if [ ! -f "dist/$js_path" ]; then
          echo -e "${YELLOW}⚠️  Content script not found in dist: $js_path${NC}"
          echo -e "${YELLOW}    (This is OK if you haven't run 'pnpm build' yet)${NC}"
        fi
      done
    done
  fi
else
  echo -e "${YELLOW}⚠️  dist directory not found. Run 'pnpm build' to check file references.${NC}"
fi

echo ""
if [ "$has_error" -eq 1 ]; then
  echo -e "${RED}❌ Manifest validation failed!${NC}"
  exit 1
else
  echo -e "${GREEN}✅ Manifest validation passed!${NC}"
fi
