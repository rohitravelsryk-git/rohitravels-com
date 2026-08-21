import os
import re

files = [
    "src/routes/_agentapp/agent/fares.tsx",
    "src/routes/admin/announcement-banner.tsx",
    "src/routes/admin/bookings.tsx",
    "src/routes/_agentapp/agent/bookings.tsx",
    "src/routes/admin/index.tsx",
    "src/routes/admin/ok-to-board.tsx",
    "src/routes/admin/sticky-notes.tsx",
    "src/components/WhatsAppDirectDialog.tsx"
]

search_pattern = re.compile(r"'''Do not make any visual modifications.*?\.\.\.".*?window\.", re.DOTALL)
replacement = "'''Do not make any visual modifications. The phrases I write are commands to understand what I want, not to be written down. Understand their content well, then execute what is required.'''"

for file_path in files:
    if not os.path.exists(file_path):
        continue
    with open(file_path, "r") as f:
        content = f.read()
    
    # We need to be careful with the regex. The user wants the specific block replaced.
    # The block starts with the '''Do not...''' line and ends somewhere.
    # Let's target the exact multiline string in code comments or UI elements.
    
    # The user provided instruction to replace:
    # "'''Do not make any visual modifications. ...''' ... (long backend summary) ... " 
    # with the simple command string.
    
    new_content = re.sub(
        r"'''Do not make any visual modifications.*?window\.\n.*?'''",
        replacement,
        content,
        flags=re.DOTALL
    )
    
    # Actually, looking at the code, the text is sometimes broken into multiple lines or has slightly different structures.
    # Let's perform a simpler replacement if possible.
    # The pattern seems to be that they all start with '''Do not...''' and have a specific long backend message.
    
    # Let's use string replace for the long backend message block
    backend_msg = """Try to fix: Scheduled backend task failing every minute (pg_net http_post call)

Context:
Summary: A recurring database job is failing continuously (100 errors within the log window, roughly once per minute). It is trying to call an HTTP function (`extensions.http_post`) with a signature that does not exist in the database, so whatever automated action it powers — likely an outbound webhook, notification, or sync trigger — is silently not running. End users will not see an error, but any feature that depends on this scheduled call is effectively broken until the function name/arguments are corrected.
Severity: high
Source: error_logs
Affected paths: supabase/migrations/20260731181928_85d02d32-6a4f-408d-8000-dcc86f4179f1.sql, supabase/migrations/20260731181856_e1b2cb33-c508-45d9-821c-5357a69778e0.sql
Deployment: https://rohitravels-com.lovable.app
Evidence: evidence_id g1: Postgres logs show 100 occurrences of `function extensions.http_post(url => unknown, headers => jsonb, body => jsonb) does not exist` between 13:46Z and 15:23Z (roughly 1/min, hit row cap).

Migrations in supabase/migrations/20260731181928_*.sql install pg_net into the `extensions` schema (`CREATE EXTENSION pg_net WITH SCHEMA extensions`). The current pg_net exposes `net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds int)` — the caller is using named args `url/headers/body` against schema `extensions`, which does not match the installed function's signature (wrong arg names/types → \"does not exist\").

No `http_post` reference exists in the repo (`supabase/**` and full search returned 0), so the caller is a DB object (likely a `pg_cron` job or trigger) created out-of-band and not tracked in migrations. Owner needs to either: (a) update the caller to use positional args / correct named args matching `extensions.http_post` signature, or (b) recreate the cron/trigger. Impact: whichever automated integration this powers has been non-functional for the whole log window."""

    if backend_msg in content:
        content = content.replace(backend_msg, "")
        # Also clean up the instruction if it's there
    
    # This is slightly risky. Let's try one more approach.
    # Just replace the whole block starting with '''Do not...''' until the next closing ''' or next logical end.
    
    with open(file_path, "w") as f:
        f.write(content)

