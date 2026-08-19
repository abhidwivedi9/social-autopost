# Vault Backups

Manual snapshots of `gke-troubleshooting-vault.html`'s live data (Firebase Realtime
Database), taken via the app's **↧ Export** button and dropped here for a git-tracked
backup independent of Firebase itself.

## Convention

- Filename: `gke-vault-YYYY-MM-DD.json`
- Contents: the full export bundle — `data` (drills/topics/problems), `myNotes`
  (My Notes tab), `refEdits` (per-command notes on the GKE/kubectl/Terraform tabs),
  and `exportedAt`.
- Cadence: nudged weekly via a scheduled reminder. Export from the app, send the
  file (or its path), it gets committed here.

## Why this exists

Firebase Realtime Database has no built-in automatic backup on the free (Spark)
plan. Local `localStorage` and the live Firebase sync both protect against a single
device or browser loss, but neither protects against the database itself being
wiped or corrupted. These snapshots are the independent, git-versioned fallback.

## Restoring from a snapshot

In the vault, click **↥ Import**, pick the snapshot file. It replaces the current
vault (drills + My Notes + per-command notes) after a confirmation prompt — export
the current state first if you want to keep it too.
