#!/bin/bash

# DiffSnap - Release ZIP Generator
# Creates a distributable ZIP file for Chrome Web Store submission

set -e

# Color codes for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "📦 DiffSnap Release ZIP Generator"
echo ""

# Parse command line arguments
SKIP_BUILD=false
SKIP_TESTS=false
OUTPUT_DIR="release"

while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-build)
      SKIP_BUILD=true
      shift
      ;;
    --skip-tests)
      SKIP_TESTS=true
      shift
      ;;
    --output)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --skip-build   Skip build step (use existing dist/)"
      echo "  --skip-tests   Skip running tests"
      echo "  --output DIR   Output directory for ZIP file (default: release/)"
      echo "  -h, --help     Show this help message"
      echo ""
      echo "Examples:"
      echo "  $0                      # Full build with tests"
      echo "  $0 --skip-tests         # Quick build without tests"
      echo "  $0 --skip-build         # Package existing dist/"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Run '$0 --help' for usage information"
      exit 1
      ;;
  esac
done

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
RELEASE_NAME="diffsnap-v${VERSION}"
RELEASE_ZIP="${RELEASE_NAME}.zip"

echo -e "${BLUE}📋 Release Information:${NC}"
echo "  Version: $VERSION"
echo "  Output: $OUTPUT_DIR/$RELEASE_ZIP"
echo ""

# Step 1: Validate manifest
echo -e "${BLUE}🔍 Step 1/6: Validating manifest...${NC}"
./scripts/validate-manifest.sh
echo ""

# Step 2: Run tests (unless skipped)
if [ "$SKIP_TESTS" = false ]; then
  echo -e "${BLUE}🧪 Step 2/6: Running tests...${NC}"
  pnpm test run
  echo ""
else
  echo -e "${YELLOW}⏭️  Step 2/6: Skipping tests${NC}"
  echo ""
fi

# Step 3: Build (unless skipped)
if [ "$SKIP_BUILD" = false ]; then
  echo -e "${BLUE}🏗️  Step 3/6: Building extension...${NC}"

  # Clean previous build
  if [ -d "dist" ]; then
    rm -rf dist
  fi

  pnpm build
  echo ""
else
  echo -e "${YELLOW}⏭️  Step 3/6: Skipping build${NC}"

  # Verify dist exists
  if [ ! -d "dist" ]; then
    echo -e "${RED}❌ Error: dist directory not found. Cannot skip build.${NC}"
    exit 1
  fi
  echo ""
fi

# Step 4: Check bundle size
echo -e "${BLUE}📏 Step 4/6: Checking bundle size...${NC}"
./scripts/check-size.sh
echo ""

# Step 5: Create release directory
echo -e "${BLUE}📁 Step 5/6: Preparing release directory...${NC}"
mkdir -p "$OUTPUT_DIR"

# Remove old release if exists
if [ -f "$OUTPUT_DIR/$RELEASE_ZIP" ]; then
  echo -e "${YELLOW}⚠️  Removing existing release: $OUTPUT_DIR/$RELEASE_ZIP${NC}"
  rm "$OUTPUT_DIR/$RELEASE_ZIP"
fi

# Step 6: Create ZIP
echo -e "${BLUE}🗜️  Step 6/6: Creating ZIP archive...${NC}"

# Change to dist directory and create ZIP
(cd dist && zip -r "../$OUTPUT_DIR/$RELEASE_ZIP" . -x "*.map" -x "*.DS_Store")

# Verify ZIP was created
if [ ! -f "$OUTPUT_DIR/$RELEASE_ZIP" ]; then
  echo -e "${RED}❌ Error: Failed to create ZIP file${NC}"
  exit 1
fi

# Get ZIP file size
ZIP_SIZE=$(du -h "$OUTPUT_DIR/$RELEASE_ZIP" | cut -f1)

echo ""
echo -e "${GREEN}✅ Release ZIP created successfully!${NC}"
echo ""
echo -e "${BLUE}📦 Release Details:${NC}"
echo "  File: $OUTPUT_DIR/$RELEASE_ZIP"
echo "  Size: $ZIP_SIZE"
echo "  Version: $VERSION"
echo ""

# List contents
echo -e "${BLUE}📂 ZIP Contents:${NC}"
unzip -l "$OUTPUT_DIR/$RELEASE_ZIP" | head -20
echo ""

# Show next steps
echo -e "${GREEN}✨ Next Steps:${NC}"
echo "  1. Test the extension:"
echo "     - Open chrome://extensions/"
echo "     - Enable 'Developer mode'"
echo "     - Click 'Load unpacked' and select dist/ directory"
echo "     - Test all functionality"
echo ""
echo "  2. Submit to Chrome Web Store:"
echo "     - Go to https://chrome.google.com/webstore/devconsole"
echo "     - Upload: $OUTPUT_DIR/$RELEASE_ZIP"
echo "     - Fill in store listing details"
echo "     - Submit for review"
echo ""

# Warning about store guidelines
echo -e "${YELLOW}⚠️  Important Reminders:${NC}"
echo "  - Test thoroughly before submission"
echo "  - Review Chrome Web Store policies"
echo "  - Prepare screenshots and promotional materials"
echo "  - Have privacy policy URL ready (if collecting data)"
echo ""
