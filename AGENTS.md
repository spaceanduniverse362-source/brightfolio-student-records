<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- Grading math (averages, ranks, GPA, pass/fail) lives only in `src/lib/grading.ts` and `src/lib/results.ts`; the SQL functions `cumulative_averages` / `verify_transcript` mirror the same semester → annual → cumulative averaging. Why: rosters, transcripts and QR verification must always agree.
- Access is role-based via `public.user_roles` (`admin`, `registrar`); every school table's RLS uses `is_staff()` / `has_role()`, and the first auth user is made admin by the `handle_new_user` trigger. Why: records are staff-only and new sign-ups need approval.
- Printed documents (rosters, transcripts) use the `--paper-*` tokens and `paper-sheet`/`doc-table` utilities and print via the browser (Save as PDF). Why: the screen UI is dark but paper must be white and A4-ready.
- Spreadsheet import/export goes through `src/lib/excel.ts`, which dynamically imports SheetJS in the browser. Why: keeps the library out of SSR and the initial bundle.
- Public transcript verification only exposes the minimal fields returned by the `verify_transcript` security-definer function, looked up by an unguessable `verification_token`. Why: QR codes are public.
- Staff may sign in with a username: `src/lib/login.ts` maps names without "@" to an internal never-mailed address and strips it for display. Why: the main admin logs in by username, not email.
