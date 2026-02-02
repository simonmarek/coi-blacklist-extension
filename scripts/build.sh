#!/bin/bash

# Build script for Chrome Web Store upload
# Creates a clean .zip file with only extension files

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PROJECT_ROOT/build"
VERSION=$(grep '"version"' "$PROJECT_ROOT/manifest.json" | sed 's/.*: "\(.*\)".*/\1/')
ZIP_NAME="coi-blacklist-extension-v${VERSION}.zip"

echo -e "${YELLOW}Building ČOI Blacklist Extension v${VERSION}${NC}"
echo ""

# Clean previous build
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Copy extension files
echo "Copying files..."
cp "$PROJECT_ROOT/manifest.json" "$BUILD_DIR/"
cp "$PROJECT_ROOT/background.js" "$BUILD_DIR/"
cp "$PROJECT_ROOT/content.js" "$BUILD_DIR/"
cp "$PROJECT_ROOT/content.css" "$BUILD_DIR/"

cp -r "$PROJECT_ROOT/popup" "$BUILD_DIR/"
cp -r "$PROJECT_ROOT/options" "$BUILD_DIR/"
cp -r "$PROJECT_ROOT/icons" "$BUILD_DIR/"
cp -r "$PROJECT_ROOT/data" "$BUILD_DIR/"

# Create zip
echo "Creating zip..."
cd "$BUILD_DIR"
zip -r "../$ZIP_NAME" . -q

# Clean up build directory
cd "$PROJECT_ROOT"
rm -rf "$BUILD_DIR"

# Output result
ZIP_SIZE=$(du -h "$ZIP_NAME" | cut -f1)
echo ""
echo -e "${GREEN}✓ Created: ${ZIP_NAME} (${ZIP_SIZE})${NC}"
echo ""
echo "Upload this file to Chrome Web Store:"
echo "https://chrome.google.com/webstore/devconsole"
