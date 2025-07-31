# GitHub Export Setup Instructions

## Quick Setup (Recommended)

1. **Open Shell tab** in Replit (next to Console)

2. **Clear any Git locks:**
```bash
rm -f .git/index.lock .git/config.lock
```

3. **Configure Git user (one-time setup):**
```bash
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"
```

4. **Add all files and commit:**
```bash
git add -A
git commit -m "Complete Telegram Member Management Tool - Production Ready"
```

5. **Push to GitHub with Personal Access Token:**
```bash
git push https://YOUR_USERNAME:YOUR_TOKEN@github.com/rapidhit/Telegram-Member-Magnet.git main
```

## How to Get Personal Access Token:

1. Go to GitHub.com → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token" → Select "repo" permissions
3. Copy the token and use it instead of your password

## Alternative: SSH Method

1. **Generate SSH key:**
```bash
ssh-keygen -t rsa -b 4096 -C "your-email@example.com"
```

2. **Add SSH key to GitHub:**
   - Copy the public key: `cat ~/.ssh/id_rsa.pub`
   - Go to GitHub Settings → SSH and GPG keys → Add SSH key

3. **Change remote URL to SSH:**
```bash
git remote set-url origin git@github.com:rapidhit/Telegram-Member-Magnet.git
```

4. **Push:**
```bash
git push origin main
```

## What You're Exporting:

✅ Complete full-stack Telegram Member Management Tool
✅ React + TypeScript frontend with modern UI
✅ Express.js backend with Telegram API integration  
✅ PostgreSQL database with Drizzle ORM
✅ Production build configuration
✅ Comprehensive documentation and setup guides
✅ All safety features and rate limiting
✅ Member extraction and addition functionality
✅ Real-time progress tracking
✅ Multi-account support

## Repository Structure:
```
Telegram-Member-Magnet/
├── client/               # React frontend
├── server/               # Express backend
├── shared/               # Shared types/schemas
├── README.md            # Setup instructions
├── package.json         # Dependencies
├── .replit              # Replit configuration
└── All other project files
```

Ready to push to: https://github.com/rapidhit/Telegram-Member-Magnet