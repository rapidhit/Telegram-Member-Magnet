#!/bin/bash

echo "🚀 Exporting Telegram Member Management Tool to GitHub..."
echo "Repository: https://github.com/rapidhit/Telegram-Member-Magnet"
echo ""

# Clear any git locks
echo "Clearing git locks..."
rm -f .git/index.lock .git/config.lock .git/refs/heads/main.lock 2>/dev/null

# Check git status
echo "Checking git status..."
git status

# Add all files
echo "Adding all files..."
git add -A

# Show what will be committed
echo "Files to be committed:"
git diff --cached --name-only

# Commit changes
echo "Committing changes..."
git commit -m "Complete Telegram Member Management Tool - Production Ready v1.0"

echo ""
echo "✅ Files committed successfully!"
echo ""
echo "Now you need to push to GitHub. You have two options:"
echo ""
echo "OPTION 1 - With Personal Access Token:"
echo "git push https://rapidhit:YOUR_GITHUB_TOKEN@github.com/rapidhit/Telegram-Member-Magnet.git main"
echo ""
echo "OPTION 2 - Simple push (may require authentication):"
echo "git push origin main"
echo ""
echo "🔑 To get a Personal Access Token:"
echo "1. Go to GitHub.com → Settings → Developer settings → Personal access tokens"
echo "2. Generate new token with 'repo' permissions"
echo "3. Copy the token and use it in OPTION 1"
echo ""
echo "📁 What's being exported:"
echo "✅ Complete full-stack Telegram Member Management Tool"
echo "✅ React + TypeScript frontend"
echo "✅ Express.js backend with Telegram API"
echo "✅ PostgreSQL database with Drizzle ORM"
echo "✅ Production build configuration"
echo "✅ Comprehensive documentation"
echo "✅ All safety features and rate limiting"