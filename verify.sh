#!/bin/bash
set -e

echo "=== Conveaux Verification Pipeline ==="
echo ""

echo "1. Installing dependencies..."
npm install
echo "   Dependencies installed"
echo ""

echo "2. Building all packages..."
npx turbo build
echo "   Build passed"
echo ""

echo "3. Running tests..."
npx turbo test
echo "   Tests passed"
echo ""

echo "=== All checks passed ==="
