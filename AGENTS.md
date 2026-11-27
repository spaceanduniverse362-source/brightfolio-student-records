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
- Access is role-based via `public.user_roles` (`admin`, `registrar`, `teacher`); `is_staff()` means admin/registrar, teachers reach only their `teacher_classes` via `is_teacher_of()` and lose mark edits once a `result_submissions` row is submitted/approved. Public sign-up is off; the admin creates teacher logins via `src/lib/teachers.functions.ts`. Why: one login page, admin controls every account.
- Transcripts print via the browser with `--paper-*` tokens; rosters and report cards are generated as PDF/ZIP in `src/lib/pdf.ts` (jsPDF, loaded on demand). Why: one-click downloads with fixed blue-bordered layout.
- Students have no auth accounts: they sign in with Student ID + `student_logins` password through the public `getMyResult` server fn, which returns only their own card and only semesters with an approved submission. Why: hundreds of students, no emails.
- Spreadsheet import/export goes through `src/lib/excel.ts`, which dynamically imports SheetJS in the browser. Why: keeps the library out of SSR and the initial bundle.
- Public transcript verification only exposes the minimal fields returned by the `verify_transcript` security-definer function, looked up by an unguessable `verification_token`. Why: QR codes are public.
- Staff may sign in with a username: `src/lib/login.ts` maps names without "@" to an internal never-mailed address and strips it for display. Why: the main admin logs in by username, not email.
