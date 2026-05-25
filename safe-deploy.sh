#!/bin/bash
# safe-deploy-ui.sh
# Safe UI deploy that checks for coworker branches before deploying

set -e

API_URL="https://ea-platform-api-693660680541.me-central1.run.app/api/v1"
PROJECT="ea-platform-20260428"
REGION="me-central1"

echo "🔍 Checking for coworker branches with unmerged changes..."

# Get all feature branches
BRANCHES=$(git branch -r | grep "origin/feature/" | grep -v "zoz" | sed 's/origin\///')

UNMERGED=0
for BRANCH in $BRANCHES; do
  # Check if branch has commits not in master
  AHEAD=$(git log origin/master..origin/$BRANCH --oneline 2>/dev/null | wc -l)
  if [ "$AHEAD" -gt "0" ]; then
    echo "⚠️  Branch '$BRANCH' has $AHEAD unmerged commit(s):"
    git log origin/master..origin/$BRANCH --oneline 2>/dev/null | head -3
    UNMERGED=1
  fi
done

if [ "$UNMERGED" -eq "1" ]; then
  echo ""
  echo "⚠️  WARNING: There are unmerged coworker branches."
  echo "   Deploying now will NOT overwrite their work (they haven't merged to master)"
  echo "   BUT you should coordinate before deploying to avoid confusion."
  echo ""
  read -p "Continue with deploy anyway? (y/N): " CONFIRM
  if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "Deploy cancelled."
    exit 0
  fi
fi

echo "✅ Proceeding with deploy..."
echo ""

# Build
echo "🔨 Building..."
REACT_APP_API_URL=$API_URL npm run build

# Deploy
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy ea-platform-ui \
  --source . \
  --region $REGION \
  --allow-unauthenticated \
  --port 8080 \
  --cpu 1 \
  --memory 512Mi \
  --project $PROJECT

echo "✅ Deploy complete!"
