#!/bin/bash

# DiffSnap - E2E Test Runner Script
# Runs end-to-end tests with Playwright for Chrome extension

set -e

# Color codes for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "🎭 DiffSnap E2E Test Runner"
echo ""

# Parse command line arguments
UI_MODE=false
DEBUG_MODE=false
HEADED=false
TEST_PATTERN=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --ui)
      UI_MODE=true
      shift
      ;;
    --debug)
      DEBUG_MODE=true
      HEADED=true
      shift
      ;;
    --headed)
      HEADED=true
      shift
      ;;
    --grep)
      TEST_PATTERN="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --ui       Run tests in UI mode (interactive)"
      echo "  --debug    Run tests in debug mode (headed + slow motion)"
      echo "  --headed   Run tests in headed mode (show browser)"
      echo "  --grep     Run tests matching pattern"
      echo "  -h, --help Show this help message"
      echo ""
      echo "Examples:"
      echo "  $0                    # Run all tests headless"
      echo "  $0 --ui               # Run in interactive UI mode"
      echo "  $0 --headed           # Run with visible browser"
      echo "  $0 --grep 'popup'     # Run only popup tests"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Run '$0 --help' for usage information"
      exit 1
      ;;
  esac
done

# Check if dist directory exists
if [ ! -d "dist" ]; then
  echo -e "${YELLOW}⚠️  dist directory not found. Building extension...${NC}"
  echo ""
  pnpm build
  echo ""
fi

# Check if Playwright is installed
if ! pnpm list @playwright/test --depth=0 &> /dev/null; then
  echo -e "${YELLOW}⚠️  Playwright not installed. This is expected for MVP phase.${NC}"
  echo -e "${YELLOW}    E2E tests will be set up in Week 6 of MVP plan.${NC}"
  echo ""
  echo -e "${BLUE}ℹ️  To install Playwright (when ready):${NC}"
  echo "  pnpm add -D @playwright/test"
  echo "  pnpm exec playwright install chromium"
  echo ""
  exit 0
fi

# Check if Playwright browsers are installed
if ! pnpm exec playwright --version &> /dev/null; then
  echo -e "${YELLOW}⚠️  Playwright browsers not installed. Installing...${NC}"
  pnpm exec playwright install chromium
  echo ""
fi

# Build test command
TEST_CMD="pnpm exec playwright test"

if [ "$UI_MODE" = true ]; then
  echo -e "${BLUE}🎨 Running tests in UI mode...${NC}"
  TEST_CMD="$TEST_CMD --ui"
elif [ "$DEBUG_MODE" = true ]; then
  echo -e "${BLUE}🔍 Running tests in debug mode...${NC}"
  TEST_CMD="$TEST_CMD --debug"
elif [ "$HEADED" = true ]; then
  echo -e "${BLUE}👁️  Running tests in headed mode...${NC}"
  TEST_CMD="$TEST_CMD --headed"
else
  echo -e "${BLUE}🚀 Running tests in headless mode...${NC}"
fi

if [ -n "$TEST_PATTERN" ]; then
  echo -e "${BLUE}🎯 Filtering tests with pattern: $TEST_PATTERN${NC}"
  TEST_CMD="$TEST_CMD --grep '$TEST_PATTERN'"
fi

echo ""

# Run tests
if eval $TEST_CMD; then
  echo ""
  echo -e "${GREEN}✅ E2E tests passed!${NC}"
  exit 0
else
  echo ""
  echo -e "${RED}❌ E2E tests failed!${NC}"
  echo ""
  echo -e "${YELLOW}💡 Troubleshooting tips:${NC}"
  echo "  - Run with --ui flag to see test execution interactively"
  echo "  - Run with --debug flag to step through tests"
  echo "  - Check if extension built correctly: ls -la dist/"
  echo "  - Verify manifest.json: ./scripts/validate-manifest.sh"
  exit 1
fi
