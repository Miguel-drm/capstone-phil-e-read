# GitHub Setup Guide - Phil-E-Read Project

## Current Status
✅ Git is already initialized locally
✅ Repository is on `main` branch
⚠️ No commits yet
⚠️ Not connected to GitHub remote

## Step-by-Step Instructions

### Step 1: Create a GitHub Repository

1. Go to [GitHub.com](https://github.com)
2. Sign in to your account (create one if needed)
3. Click the **+** icon in the top right → **New repository**
4. Fill in the details:
   - **Repository name**: `capstone-phil-e-read` (or your preferred name)
   - **Description**: "Phil-E-Read: Advanced Reading Assessment System with AI-Powered Miscue Detection"
   - **Visibility**: Choose **Private** (recommended for capstone projects)
   - **Initialize repository**: Leave unchecked (we already have local files)
5. Click **Create repository**

### Step 2: Add GitHub Remote

After creating the repository, GitHub will show you commands. Run these in your terminal:

```bash
git -C "C:/Users/Jeybii/Downloads/capstone-phil-e-read-0a874c18d47433e390930405088a6b95f3be971a/capstone-phil-e-read-0a874c18d47433e390930405088a6b95f3be971a" remote add origin https://github.com/YOUR_USERNAME/capstone-phil-e-read.git
```

Replace `YOUR_USERNAME` with your actual GitHub username.

### Step 3: Verify Remote Connection

```bash
git -C "C:/Users/Jeybii/Downloads/capstone-phil-e-read-0a874c18d47433e390930405088a6b95f3be971a/capstone-phil-e-read-0a874c18d47433e390930405088a6b95f3be971a" remote -v
```

You should see:
```
origin  https://github.com/YOUR_USERNAME/capstone-phil-e-read.git (fetch)
origin  https://github.com/YOUR_USERNAME/capstone-phil-e-read.git (push)
```

### Step 4: Stage All Files

```bash
git -C "C:/Users/Jeybii/Downloads/capstone-phil-e-read-0a874c18d47433e390930405088a6b95f3be971a/capstone-phil-e-read-0a874c18d47433e390930405088a6b95f3be971a" add .
```

### Step 5: Create Initial Commit

```bash
git -C "C:/Users/Jeybii/Downloads/capstone-phil-e-read-0a874c18d47433e390930405088a6b95f3be971a/capstone-phil-e-read-0a874c18d47433e390930405088a6b95f3be971a" commit -m "Initial commit: Phil-E-Read project with advanced miscue detection algorithms"
```

### Step 6: Push to GitHub

```bash
git -C "C:/Users/Jeybii/Downloads/capstone-phil-e-read-0a874c18d47433e390930405088a6b95f3be971a/capstone-phil-e-read-0a874c18d47433e390930405088a6b95f3be971a" branch -M main
```

Then push:

```bash
git -C "C:/Users/Jeybii/Downloads/capstone-phil-e-read-0a874c18d47433e390930405088a6b95f3be971a/capstone-phil-e-read-0a874c18d47433e390930405088a6b95f3be971a" push -u origin main
```

### Step 7: Verify on GitHub

1. Go to your GitHub repository URL: `https://github.com/YOUR_USERNAME/capstone-phil-e-read`
2. You should see all your files uploaded
3. Verify the commit message appears in the commit history

## Using Git Bash or PowerShell (Easier)

Instead of long paths, you can use Git Bash or PowerShell:

### Option A: Git Bash
1. Open Git Bash
2. Navigate to your project:
   ```bash
   cd "C:/Users/Jeybii/Downloads/capstone-phil-e-read-0a874c18d47433e390930405088a6b95f3be971a/capstone-phil-e-read-0a874c18d47433e390930405088a6b95f3be971a"
   ```
3. Run the commands above without the `git -C` prefix

### Option B: PowerShell
1. Open PowerShell
2. Navigate to your project:
   ```powershell
   cd "C:\Users\Jeybii\Downloads\capstone-phil-e-read-0a874c18d47433e390930405088a6b95f3be971a\capstone-phil-e-read-0a874c18d47433e390930405088a6b95f3be971a"
   ```
3. Run the commands above

## Quick Command Summary

```bash
# Add remote
git remote add origin https://github.com/YOUR_USERNAME/capstone-phil-e-read.git

# Verify remote
git remote -v

# Stage all files
git add .

# Create commit
git commit -m "Initial commit: Phil-E-Read project with advanced miscue detection algorithms"

# Set main branch and push
git branch -M main
git push -u origin main
```

## Authentication

### If Using HTTPS (Recommended for beginners)
- GitHub will prompt for credentials
- Use your GitHub username and a **Personal Access Token** (not your password)
- To create a token: GitHub Settings → Developer settings → Personal access tokens → Generate new token
- Select scopes: `repo`, `workflow`

### If Using SSH (More secure)
1. Generate SSH key:
   ```bash
   ssh-keygen -t ed25519 -C "your_email@example.com"
   ```
2. Add to GitHub: Settings → SSH and GPG keys → New SSH key
3. Use SSH URL: `git@github.com:YOUR_USERNAME/capstone-phil-e-read.git`

## After Initial Push

### For Future Commits
```bash
git add .
git commit -m "Your commit message"
git push
```

### Create Branches for Features
```bash
git checkout -b feature/miscue-toggle
# Make changes
git add .
git commit -m "Add miscue toggle feature"
git push -u origin feature/miscue-toggle
```

## Recommended .gitignore Entries

Your `.gitignore` should already have:
```
node_modules/
.env
.env.local
dist/
build/
*.log
.DS_Store
```

Make sure these are included to avoid committing sensitive files.

## Project Structure for GitHub

```
capstone-phil-e-read/
├── frontend/              # React/TypeScript frontend
├── backend/               # Node.js/Express backend
├── DETECTION/             # Miscue detection algorithms
├── README.md              # Project overview
├── .gitignore             # Git ignore rules
├── package.json           # Dependencies
└── [other config files]
```

## Troubleshooting

### "fatal: remote origin already exists"
```bash
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/capstone-phil-e-read.git
```

### "Permission denied (publickey)"
- You're using SSH but haven't set up SSH keys
- Either generate SSH keys or use HTTPS instead

### "fatal: 'origin' does not appear to be a 'git' repository"
- Remote not added yet
- Run: `git remote add origin https://github.com/YOUR_USERNAME/capstone-phil-e-read.git`

### "Everything up-to-date"
- All files already pushed
- Make changes and commit again

## Next Steps

1. ✅ Create GitHub repository
2. ✅ Add remote origin
3. ✅ Stage and commit files
4. ✅ Push to GitHub
5. Add collaborators (if needed): Settings → Collaborators
6. Set up branch protection rules (optional)
7. Enable GitHub Actions for CI/CD (optional)

## Resources

- [GitHub Docs](https://docs.github.com)
- [Git Documentation](https://git-scm.com/doc)
- [GitHub CLI](https://cli.github.com/) - Alternative to web interface

---

**Need help?** Let me know if you encounter any issues during the setup!
