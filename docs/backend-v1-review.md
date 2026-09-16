# Backend V1 repair and preview review

## Current State Check (before changes, 2026-09-16)

- Branch: `feat/backend-v1`; clean worktree; local and remote HEAD: `99c0bcea18148cd4bee1ad4891ae60e54846e52c`.
- Local and remote main: `052438ae0605d8365db15974ec4ec6c44d2433e0`.
- Latest five commits: `99c0bce` public integration, `fdb55f7` CMS routing/pages, `1c5bb39` authentication/services, `ad13a3f` database schema, `052438a` public link fixes.
- Existing modules: login/dashboard, project/article CRUD, site settings, media, public hooks, structured detail rendering.
- Confirmed defects: session-only guard; authenticated-wide RLS/storage mutations; static fallback after empty/error queries in services/App/sections/details; static site sections; hardcoded sort order; missing table editor; GIF accepted inconsistently; missing public loading/empty/error states.
- Additional findings: About had no admin editing controls; archive selection lacked a current-status save button; recursive media listing lost parent paths and stopped at 100 entries; Dashboard swallowed failures; empty About arrays could crash rendering.
- Already correct: published filter and query ordering, slug precheck, detail table renderer, env ignore rules. No later fixes or uncommitted user changes existed.
- Initial lint/build passed. Existing bundle-size warning remains. Scripts initially: dev/build/lint/preview. Only empty `.env.example` existed; no actual local Supabase configuration.

## Changes

- `admin_users(user_id uuid primary key references auth.users(id), created_at timestamptz default now())`; deletion of auth user cascades. No user-facing membership management or RBAC.
- Auth provider checks the current user's own membership on initial session, login and auth changes. Guard requires both session and verified membership; errors deny access. Revalidating the same verified user does not unmount unsaved forms. RLS remains the security boundary.
- Configured services return empty arrays/null as received and throw query failures. Static data is used only without Supabase configuration. App/sections/details no longer import fallback records. URL detail lookup uses only the current published list, with loading/error/not-found states and browser navigation support.
- A single `useSiteSettings` call feeds Hero/About/Contact. Site intro/currently/location, building/learning/exploring, contact and About now use database fields. Partial JSON objects receive empty defaults, never static profile values. Admin About supports basic text and editable lists. Missing settings can be created; failed loads block saving.
- Editors load and preserve database sort order, validate integer range, and expose numeric inputs (default 0). Queries retain `sort_order ASC, created_at DESC`. The current-status save button supports archiving. Failed record loads block saving.
- Article table editor supports add/remove table, headers, columns, rows and cells; serialized shape remains `{ headers: string[], rows: string[][] }`. Existing detail rendering is retained.
- Media accepts JPG/JPEG/PNG/WEBP, rejects GIF and files over 5 MiB (5 × 1024 × 1024 bytes). The bucket enforces MIME types and size too. Listing includes nested folders and pagination. Upload names use UUIDs. Saving a project is blocked while its cover is uploading.
- Old cover objects are intentionally retained: even a bucket-owned URL may be referenced elsewhere. No external URL is deleted. Cleanup remains an explicit media-library operation.
- Dashboard reports fetch errors; duplicate-key conflicts during concurrent saves get a friendly slug message.

## Upgrade and permissions

New migration: `supabase/migrations/20260916044953_fix_backend_v1.sql`, generated using Supabase CLI. The original migration is unchanged. Apply the new migration once after the initial schema in the designated **Preview** Supabase project. Do not rerun the seed on an existing edited site: its upserts overwrite content. Do not reset the database.

| Actor | Projects/articles | Site settings | Media | admin_users |
| --- | --- | --- | --- | --- |
| Anonymous | Published SELECT only | SELECT | Public media SELECT/URLs | No access |
| Authenticated non-admin | Published SELECT only | SELECT | Public media SELECT/URLs | Own membership SELECT (empty) |
| Verified admin | All SELECT/INSERT/UPDATE/DELETE | SELECT/INSERT/UPDATE/DELETE | media bucket SELECT/INSERT/UPDATE/DELETE | Own membership SELECT only |

The migration removes every broad admin policy in the initial migration, grants only intended table operations, and adds membership predicates to both `USING` and `WITH CHECK`. Existing public read policies are retained. Browser roles cannot self-enroll or promote anyone. No security-definer function or hardcoded-email boundary is used. Public media remains public even if a related article is a draft; private draft assets are outside V1 scope.

### Provision the single administrator

1. In the Preview Supabase Dashboard, disable public **Allow new users to sign up** (also leave anonymous sign-in disabled). This is appropriate for this single-admin CMS, but does not replace RLS.
2. In Authentication → Users, create/invite the owner with a strong password; copy the user's UUID from `auth.users`.
3. As the trusted database administrator in SQL Editor, replace the placeholder and run:

   ```sql
   insert into public.admin_users (user_id)
   values ('REPLACE_WITH_AUTH_USER_UUID'::uuid)
   on conflict (user_id) do nothing;
   ```

4. Provision only the owner. The table supports membership lookup; V1 has no multi-admin UI. Keep membership mutations restricted to trusted database administration.
5. Put only `VITE_SUPABASE_URL` and the public anon/publishable key in the Preview build environment. Never put a service-role key or database password in `src`, any `VITE_*` value, or Git. Rebuild when Vite environment variables change.
6. Log in and confirm `/admin/dashboard`; use a separately provisioned non-member account to confirm denial, then verify REST reads/writes with that user's token (not the service role). A frontend guard alone is insufficient evidence.
7. To revoke admin access: `delete from public.admin_users where user_id = 'UUID'::uuid;`. Database privileges disappear on the next query. The frontend revalidates on auth events; it may display the existing shell until that event, but database mutations remain denied.

Official reference: [Supabase RLS and grants](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Verification

```sh
npm ci
npm run lint
npm run build
npm test
npx playwright install chromium
npm run test:e2e
```

To reuse installed Chrome in PowerShell: `$env:PLAYWRIGHT_CHANNEL='chrome'; npm run test:e2e`.

- `npm test` executes the original schema, seed, and upgrade in PGlite (real PostgreSQL engine with minimal auth/storage test schemas), and exercises anon/member/admin roles, CRUD, cross-bucket denial, self-enrollment denial, and membership revocation. Service tests cover empty/error/local data, membership failure, slug races, media validation, and nested pagination.
- Playwright uses the actual browser UI and Supabase JS client against intercepted HTTP fixtures. It covers public navigation/details, configured loading/empty/error/missing records, non-admin denial, project/article lifecycle and sort preservation, table persistence, slug conflicts, settings synchronization, media/cover upload and deletion, and mobile/history behavior. It is **not** a live Supabase integration test.
- Browser visual inspection uses agent-browser against the local unconfigured site; existing hero/nav/layout are preserved.

## Known issues / Preview acceptance required

- No live Preview URL, Supabase environment, or test-account credentials were configured in this checkout. The connector listed one INACTIVE Supabase project, with no verified association to this repository. It was not restored, migrated, seeded, or modified.
- Hosted GoTrue login, hosted RLS deployment, Storage HTTP MIME/size enforcement, and real uploads remain Preview acceptance checks. Local SQL tests validate policy semantics; HTTP browser fixtures validate application behavior. Neither proves a remote migration has been applied.
- Original production build bundle-size advisory remains; this repair does not perform an unrelated bundle refactor.
- Media is public by design and old covers are not automatically garbage-collected.
- Initial seed upserts overwrite records, so existing installations should apply only the upgrade migration.
- No production deployment, main merge, production-branch setting change, or main push is part of this work.

## Changed files

- `.gitignore`
- `docs/backend-v1-review.md`
- `package-lock.json`
- `package.json`
- `playwright.config.ts`
- `src/App.css`
- `src/App.tsx`
- `src/admin/components/AdminAuthGuard.tsx`
- `src/admin/components/ArticleTableEditor.tsx`
- `src/admin/pages/AdminArticleEditor.tsx`
- `src/admin/pages/AdminDashboard.tsx`
- `src/admin/pages/AdminMedia.tsx`
- `src/admin/pages/AdminProjectEditor.tsx`
- `src/admin/pages/AdminSiteSettings.tsx`
- `src/components/DataState.tsx`
- `src/components/DetailModal.tsx`
- `src/components/SiteSettingsState.tsx`
- `src/components/sections/AboutSection.tsx`
- `src/components/sections/ContactSection.tsx`
- `src/components/sections/HeroSection.tsx`
- `src/components/sections/NotesSection.tsx`
- `src/components/sections/WorkSection.tsx`
- `src/context/AdminAuthContext.tsx`
- `src/context/AdminAuthContextDefinition.ts`
- `src/hooks/useArticles.ts`
- `src/hooks/useProjects.ts`
- `src/hooks/useSiteSettings.ts`
- `src/services/adminService.ts`
- `src/services/articleService.ts`
- `src/services/mediaService.ts`
- `src/services/projectService.ts`
- `src/services/siteService.ts`
- `supabase/migrations/20260916044953_fix_backend_v1.sql`
- `tests/e2e/backend.spec.ts`
- `tests/rls.test.ts`
- `tests/services.test.ts`
- `vitest.config.ts`

## Final execution results (2026-09-16)

- npm ci: PASS, 82 packages installed from the final lockfile. Windows development-server file locks were released before the successful retry.
- npm run lint: PASS, no lint warnings/errors.
- npm run build: PASS; existing >500 kB chunk advisory only.
- npm test: PASS, 2 files / 16 tests.
- npm run test:e2e with installed Chrome: PASS, 8 tests, 48.2 seconds. An earlier run had one article-detail wait timeout during ongoing local edits; isolated retest and the final frozen-source full run both passed.
- git diff --check: PASS.
- Secret scan: no actual service-role JWT, secret API key, private key or password-bearing database URL found in the reviewed source/new files; no service-role credential found in the browser bundle. The SDK's literal key-prefix recognition string is not a credential.
- .env, .env.local and .env.production: verified ignored; only the blank .env.example is tracked.
- The initial schema and seed are unchanged.
- Status: Ready for Preview Review. Hosted Preview acceptance remains required as detailed above.
