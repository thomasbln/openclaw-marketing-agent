# Messaging – Market Research

Your product/landing-page texts. Imported into the `messaging` table for `/wording 7d` Block 4 – language contrast: **Radar (market signals)** vs. **Your messaging**.

**Format:** `key: value` per line (no YAML syntax). All example texts are in English.

**Example:** `homepage.md` with neutral placeholder content. Replace with your own to compare against real market signals.

## Import

```bash
# From openclaw/
./scripts/trigger-import-messaging.sh          # Upsert (update existing)
./scripts/trigger-import-messaging.sh --replace  # Clear table, then import files only
```

**Prerequisite:** Messaging table exists in DB (see main README Quick Start), signal-radar image built for trigger script.
