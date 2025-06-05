#!/bin/bash

# Element Extractor Extension Validation Script
echo "🔍 Elements Extractor Extension Validation"
echo "==========================================="

cd "$(dirname "$0")"

# Check if all required files exist
echo "📁 Checking required files..."
required_files=("manifest.json" "popup.html" "popup.css" "popup.js" "contentScript.js" "background.js")
missing_files=()

for file in "${required_files[@]}"; do
    if [[ -f "$file" ]]; then
        echo "✅ $file - Found"
    else
        echo "❌ $file - Missing"
        missing_files+=("$file")
    fi
done

# Check if assets directory exists
if [[ -d "assets/icons" ]]; then
    echo "✅ assets/icons/ - Found"
    icon_count=$(find assets/icons -name "*.png" | wc -l)
    echo "   📊 Found $icon_count PNG icon files"
else
    echo "❌ assets/icons/ - Missing"
    missing_files+=("assets/icons")
fi

# Check manifest.json syntax
echo ""
echo "🔧 Validating manifest.json..."
if command -v jq >/dev/null 2>&1; then
    if jq empty manifest.json >/dev/null 2>&1; then
        echo "✅ manifest.json - Valid JSON syntax"
    else
        echo "❌ manifest.json - Invalid JSON syntax"
    fi
else
    echo "⚠️  jq not available - Cannot validate JSON syntax"
fi

# Check for key manifest properties
if [[ -f "manifest.json" ]]; then
    manifest_version=$(grep -o '"manifest_version"[[:space:]]*:[[:space:]]*[0-9]*' manifest.json | grep -o '[0-9]*')
    if [[ "$manifest_version" == "3" ]]; then
        echo "✅ manifest.json - Manifest V3 detected"
    else
        echo "⚠️  manifest.json - Manifest version: $manifest_version"
    fi
fi

# Check file sizes (basic validation)
echo ""
echo "📊 File size validation..."
for file in "${required_files[@]}"; do
    if [[ -f "$file" ]]; then
        size=$(wc -c < "$file" 2>/dev/null || echo "0")
        if [[ $size -gt 100 ]]; then
            echo "✅ $file - Size: ${size} bytes (OK)"
        elif [[ $size -gt 0 ]]; then
            echo "⚠️  $file - Size: ${size} bytes (Small)"
        else
            echo "❌ $file - Empty file"
        fi
    fi
done

# Check for common JavaScript issues
echo ""
echo "🐛 Basic JavaScript validation..."
js_files=("popup.js" "contentScript.js" "background.js")
for file in "${js_files[@]}"; do
    if [[ -f "$file" ]]; then
        # Check for syntax errors using node if available
        if command -v node >/dev/null 2>&1; then
            if node -c "$file" >/dev/null 2>&1; then
                echo "✅ $file - No syntax errors detected"
            else
                echo "❌ $file - Syntax errors detected"
            fi
        else
            # Basic checks without node
            if grep -q "function\|const\|let\|var" "$file"; then
                echo "✅ $file - Contains JavaScript code"
            else
                echo "⚠️  $file - May be empty or invalid"
            fi
        fi
    fi
done

# Summary
echo ""
echo "📋 Validation Summary"
echo "===================="
if [[ ${#missing_files[@]} -eq 0 ]]; then
    echo "✅ All required files present"
    echo "🎉 Extension appears ready for testing!"
    echo ""
    echo "🚀 Next Steps:"
    echo "1. Load the extension in Chrome (chrome://extensions/)"
    echo "2. Enable Developer mode"
    echo "3. Click 'Load unpacked' and select this directory"
    echo "4. Open test-extension.html and test functionality"
else
    echo "❌ Missing files detected:"
    for file in "${missing_files[@]}"; do
        echo "   - $file"
    done
    echo ""
    echo "⚠️  Please ensure all files are present before loading the extension"
fi

echo ""
echo "📖 For detailed documentation, see the guide/ directory"
echo "🌐 GitHub Repository: https://github.com/ArogyaReddy/elements-extractor-chrome-extension"