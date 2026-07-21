#!/bin/bash
# Creates Cloud Scheduler jobs to trigger each scheduled slot via the Cloud Run bot's
# /trigger/:slotKey endpoint. Run this ONCE after your Cloud Run service is deployed.
#
# Fill these in first:
SERVICE_URL="https://social-autopost-bot-934230837260.asia-south1.run.app"   # from `gcloud run services describe`
SCHEDULER_SECRET="7313094be6445c44d7c94164f968c15a"            # must match the Cloud Run env var
PROJECT="terraform-gke-learning"                    # your GCP project
LOCATION="asia-south1"                              # scheduler jobs need a region too

declare -A SLOTS=(
  ["autopost-7am-news"]="0 7 * * *|7am"
  ["autopost-8am-india-news"]="0 8 * * *|india_news_hi"
  ["autopost-5pm-gaming"]="0 17 * * *|5pm"
  # All other slots (6am, 9am, 11am, 1pm, 9pm) stay manual-only via typing "post" —
  # only these 3 are both scheduled AND auto-posting without approval.
)

for job in "${!SLOTS[@]}"; do
  cron="${SLOTS[$job]%%|*}"
  slot="${SLOTS[$job]##*|}"
  echo "Creating $job -> slot $slot at [$cron] IST"
  gcloud scheduler jobs create http "$job" \
    --project="$PROJECT" \
    --location="$LOCATION" \
    --schedule="$cron" \
    --time-zone="Asia/Kolkata" \
    --uri="${SERVICE_URL}/trigger/${slot}" \
    --http-method=POST \
    --headers="X-Scheduler-Secret=${SCHEDULER_SECRET}"
done
