# Backups

## What to back up

- The Zezpon database file
- Uploaded video files if you are using local storage
- Environment variables stored outside the repo

## Recommended production approach

- Use scheduled daily backups for the database
- Keep at least one off-server copy
- Test a restore process before launch
- If you use S3-compatible storage, enable bucket versioning when available

## Local storage paths

- Database: `ZEZPON_DATA_DIR/zezpon.db`
- Uploads: `ZEZPON_DATA_DIR/uploads`

## Restore checklist

1. Stop the app
2. Replace the database with the backup copy
3. Restore uploaded files if needed
4. Start the app
5. Verify login, video playback, and admin access

## Before launch

- Automate backups with Task Scheduler, cron, or your hosting provider
- Keep backups out of OneDrive-synced runtime folders
- Record who can access backups and where they are stored
