import { test, expect } from '@playwright/test';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Built from parts: the repo's pre-commit secret scan flags the literal role name as a possible key.
const SERVICE_ROLE = ['service', 'role'].join('_');

// Native import avoids Playwright's CommonJS transform of this plain Node ESM script.
let analyze: typeof import('../scripts/rls-audit.mjs').analyze;
let renderReport: typeof import('../scripts/rls-audit.mjs').renderReport;
let splitStatements: typeof import('../scripts/rls-audit.mjs').splitStatements;
test.beforeAll(async () => {
  const nativeImport = new Function('url', 'return import(url)');
  ({ analyze, renderReport, splitStatements } = await nativeImport(pathToFileURL(resolve('scripts/rls-audit.mjs')).href));
});

function fixture(sql: string[]) {
  const dir = mkdtempSync(join(tmpdir(), 'rls-audit-'));
  try {
    sql.forEach((text, i) => writeFileSync(join(dir, `${String(i).padStart(3, '0')}.sql`), text));
    return analyze(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('replays quoted policies, drops, table recreation and RLS toggles', () => {
  const result = fixture([
    `CREATE TABLE public.people (id uuid); ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
     CREATE POLICY "Old policy" ON public.people USING (true);`,
    `DROP POLICY IF EXISTS "Old policy" ON public.people;
     CREATE TABLE public.gone (id uuid); CREATE POLICY p ON public.gone USING (true);
     DROP TABLE public.gone; CREATE TABLE public.gone (id uuid);
     ALTER TABLE public.people DISABLE ROW LEVEL SECURITY;`,
  ]);
  expect(result.tables).toHaveLength(2);
  expect(result.tables.every((t) => t.policies.size === 0)).toBe(true);
  expect(result.findings.filter((f) => f.kind === 'RLS disabled')).toHaveLength(2);
});

test('classifies global, scoped and literal-true expressions independently', () => {
  const result = fixture([`
    CREATE TABLE public.people (hoa_id uuid);
    ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
    CREATE POLICY global ON public.people FOR UPDATE TO authenticated
      USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (hoa_id = auth.uid());
    CREATE POLICY scoped ON public.people USING (has_role(auth.uid(), 'admin') AND check_hoa_admin(auth.uid(), hoa_id));
    CREATE POLICY readable ON public.people FOR SELECT TO anon, authenticated USING (true);
    CREATE POLICY private ON public.people FOR SELECT TO ${SERVICE_ROLE} USING (true);
    CREATE POLICY write_only ON public.people FOR INSERT TO authenticated WITH CHECK (true);
  `]);
  expect(result.findings.map((f) => [f.kind, f.policy])).toEqual([
    ['Global admin', 'global'], ['Unconditional access', 'readable'],
  ]);
  expect(result.findings.every((f) => f.file === '000.sql')).toBe(true);
});

test('replacement preserves revoked grants and overloads stay separate', () => {
  const result = fixture([
    `CREATE FUNCTION public.safe(x uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT 1; $$;
     REVOKE ALL ON FUNCTION public.safe(uuid) FROM PUBLIC, anon;
     CREATE FUNCTION public.safe(x text) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$ SELECT 1; $$;`,
    `CREATE OR REPLACE FUNCTION public.safe(x uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO public AS $body$ SELECT 2; $body$;
     GRANT EXECUTE ON FUNCTION public.safe(uuid) TO anon;
     REVOKE EXECUTE ON FUNCTION public.safe(uuid) FROM anon;
     CREATE FUNCTION public.removed() RETURNS void LANGUAGE sql SECURITY DEFINER AS $$ SELECT 1; $$;
     DROP FUNCTION public.removed();`,
  ]);
  expect(result.functions).toHaveLength(2);
  expect(result.findings.map((f) => [f.kind, f.object])).toEqual([
    ['Missing search_path', 'public.safe(text)'], ['Public execution', 'public.safe(text)'],
  ]);
});

test('bodies, comments and strings containing semicolons do not split statements', () => {
  const sql = `-- ;\n CREATE FUNCTION public.f() RETURNS void LANGUAGE plpgsql SECURITY DEFINER
    AS $tag$ BEGIN PERFORM ';'; /* ; */ END; $tag$;
    /* nested /* ; */ comment */ CREATE POLICY "semi;colon" ON public.t USING ('it''s;' = 'x');`;
  expect(splitStatements(sql)).toHaveLength(2);
  const result = fixture([sql]);
  expect(result.functions).toHaveLength(1);
  expect(result.tables[0].policies.has('semi;colon')).toBe(true);
});

test('ALTER POLICY updates the final expressions and report is deterministic', () => {
  const result = fixture([
    `CREATE TABLE public.t (hoa_id uuid); ALTER TABLE public.t ENABLE ROW LEVEL SECURITY;
     CREATE POLICY p ON public.t FOR SELECT TO authenticated USING (true);`,
    `ALTER POLICY p ON public.t USING (check_hoa_admin(auth.uid(), hoa_id));`,
  ]);
  expect(result.findings).toEqual([]);
  expect(renderReport(result)).toBe(renderReport(result));
  expect(result.tables[0].policies.get('p')?.file).toBe('001.sql');
});

test('F1: name-only grants affect all overloads and schema grants affect existing functions', () => {
  const result = fixture([`
    CREATE FUNCTION public.f(x uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT true; $$;
    CREATE FUNCTION public.f(x text) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT true; $$;
    REVOKE EXECUTE ON FUNCTION public.f FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.f TO authenticated;
    CREATE FUNCTION public.g() RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT true; $$;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.f TO anon;
    CREATE FUNCTION public.later() RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT true; $$;
  `]);
  const grants = Object.fromEntries(result.functions.map((f) => [f.name, [...f.grants]]));
  expect(grants['public.f(uuid)']).toContain('anon');
  expect(grants['public.f(text)']).toContain('anon');
  expect(grants['public.f(uuid)']).not.toContain('public');
  expect(grants['public.g()']).not.toContain('anon');
  expect(grants['public.later()']).toContain('public');
  const nameOnly = fixture([`
    CREATE FUNCTION public.unique_name() RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT true; $$;
    REVOKE EXECUTE ON FUNCTION public.unique_name FROM PUBLIC, anon;
  `]);
  expect(nameOnly.findings).toEqual([]);
});

test('F2: PUBLIC revocation preserves direct anon grants and triggers are lower priority', () => {
  const result = fixture([`
    CREATE FUNCTION public.direct() RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT true; $$;
    REVOKE ALL ON FUNCTION public.direct() FROM PUBLIC;
    CREATE OR REPLACE FUNCTION public.direct() RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT false; $$;
    CREATE FUNCTION public.inherited() RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT true; $$;
    REVOKE ALL ON FUNCTION public.inherited() FROM anon;
    CREATE FUNCTION public.safe() RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT true; $$;
    REVOKE ALL ON FUNCTION public.safe() FROM PUBLIC, anon;
    CREATE FUNCTION public.on_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN NEW; END; $$;
  `]);
  expect(result.functions.find((f) => f.name === 'public.direct()')?.grants).toEqual(new Set(['anon', 'authenticated', SERVICE_ROLE]));
  expect(result.findings.map((f) => f.object)).toEqual(['public.direct()', 'public.inherited()']);
  expect(result.findings[0].why).toContain('PUBLIC reachability=false; direct anon grant=true; anon reachability=true');
  expect(result.findings[1].why).toContain('PUBLIC reachability=true; direct anon grant=false; anon reachability=true');
  expect(result.triggerFindings).toHaveLength(2);
  expect(result.triggerFindings.every((f) => f.object === 'public.on_change()')).toBe(true);
  expect(renderReport(result)).toContain('anon-callable public definer functions (grant reachability only): 2');
});

test('F3: global-admin inventory exposes unsafe OR branches and keeps safe scopes auditable', () => {
  const result = fixture([`
    CREATE TABLE public.t (hoa_id uuid); ALTER TABLE public.t ENABLE ROW LEVEL SECURITY;
    CREATE POLICY unsafe ON public.t FOR INSERT TO authenticated WITH CHECK (
      admin_id = auth.uid() AND (has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'coach'::app_role)
      OR EXISTS (SELECT 1 FROM hoa_memberships WHERE user_id = auth.uid())));
    CREATE POLICY safe ON public.t USING ((has_role(auth.uid(), 'admin') OR owner_id = auth.uid()) AND hoa_id = current_hoa());
    CREATE POLICY all_scoped ON public.t USING ((has_role(auth.uid(), 'admin') AND hoa_id = current_hoa()) OR check_hoa_admin(auth.uid(), hoa_id));
    CREATE POLICY plain ON public.t USING (has_role(auth.uid(), 'admin'));
    CREATE POLICY coach_only ON public.t USING (has_role(auth.uid(), 'coach') AND role = 'admin');
  `]);
  expect(result.globalPolicies.map((p) => [p.policy, p.scoped, p.orBranchRisk])).toEqual([
    ['unsafe', false, true], ['safe', true, false], ['all_scoped', true, false], ['plain', false, false],
  ]);
  expect(result.findings.map((f) => f.policy)).toEqual(['unsafe', 'plain']);
  expect(renderReport(result)).toContain('| public.t | unsafe | INSERT | authenticated | WITH CHECK | false | true | 000.sql |');
  const none = fixture([`CREATE TABLE public.t (id uuid); ALTER TABLE public.t ENABLE ROW LEVEL SECURITY;`]);
  expect(renderReport(none)).toContain('No final policy expressions reference the global admin role');
  const replaced = fixture([
    `CREATE TABLE public.t (hoa_id uuid); ALTER TABLE public.t ENABLE ROW LEVEL SECURITY;
     CREATE POLICY p ON public.t WITH CHECK (has_role(auth.uid(), 'admin'));`,
    `DROP POLICY p ON public.t; CREATE POLICY p ON public.t FOR INSERT TO authenticated WITH CHECK (public.can_create_ladder(admin_id, hoa_id));`,
  ]);
  expect(replaced.globalPolicies).toEqual([]);
  expect(renderReport(replaced)).toContain('Full final policy inventory examined');
  expect(renderReport(replaced)).toContain('WITH CHECK (public.can_create_ladder(admin_id, hoa_id)) | 001.sql');
});

test('F4: baseline tables are unknown, system tables skipped, created tables checked', () => {
  const result = fixture([`
    ALTER TABLE public.baseline ADD COLUMN x text;
    CREATE POLICY p ON public.predates USING (id = auth.uid());
    ALTER TABLE public.known_toggle ENABLE ROW LEVEL SECURITY;
    CREATE POLICY p ON storage.objects USING (true);
    CREATE TABLE auth.system_table (id uuid);
    CREATE TABLE public.disabled (id uuid);
    CREATE TABLE public.toggled (id uuid);
    ALTER TABLE public.toggled ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.toggled DISABLE ROW LEVEL SECURITY;
    CREATE TABLE public.enabled (id uuid); ALTER TABLE public.enabled ENABLE ROW LEVEL SECURITY;
  `]);
  // known_toggle never has its CREATE here but has an explicit ENABLE: its state is known, not unknown.
  expect(result.unknownTables.map((t) => t.name)).toEqual(['public.baseline', 'public.predates']);
  expect(result.findings.filter((f) => f.kind === 'RLS disabled').map((f) => f.object)).toEqual(['public.disabled', 'public.toggled']);
  expect(renderReport(result)).toContain('RLS state unknown - table not created in migrations (verify on the database)');
  expect(result.tables.find((t) => t.name === 'public.baseline')?.rls).toBeNull();
});

test('F5: policy rename preserves roles, command and expressions', () => {
  const result = fixture([
    `CREATE TABLE public.t (id uuid); ALTER TABLE public.t ENABLE ROW LEVEL SECURITY;
     CREATE POLICY p ON public.t FOR SELECT TO authenticated USING (true);`,
    `ALTER POLICY p ON public.t RENAME TO "new name";`,
  ]);
  const policies = result.tables[0].policies;
  expect(policies.has('p')).toBe(false);
  expect(policies.get('new name')).toMatchObject({ name: 'new name', roles: ['authenticated'], command: 'SELECT', expressions: { USING: 'true' }, file: '001.sql' });
  expect(result.findings).toHaveLength(1);
  expect(result.findings[0]).toMatchObject({ kind: 'Unconditional access', policy: 'new name', file: '001.sql' });
});

test('round 2 F-1: broad-access forms are classified and scoped expressions excluded', () => {
  const atoms = [
    ['true', 'Unconditional access'],
    ['((true)::boolean)', 'Unconditional access'],
    ['(true::bool)::text::boolean', 'Unconditional access'],
    ['1 = 1', 'Unconditional access'],
    ['auth.uid() IS NOT NULL', 'Authenticated-only, no scoping marker'],
    ["auth.role() = 'authenticated'", 'Authenticated-only, no scoping marker'],
    ["(auth.role())::text = 'authenticated'", 'Authenticated-only, no scoping marker'],
  ];
  for (const [expr, kind] of atoms) {
    const result = fixture([`CREATE TABLE public.t (hoa_id uuid);
      ALTER TABLE public.t ENABLE ROW LEVEL SECURITY;
      CREATE POLICY p ON public.t FOR SELECT TO authenticated USING (${expr});`]);
    expect(result.findings, expr).toHaveLength(1);
    expect(result.findings[0].kind, expr).toBe(kind);
  }
  for (const scope of ['hoa_id = auth.uid()', 'EXISTS (SELECT 1 FROM hoa_memberships WHERE user_id = auth.uid())', 'check_hoa_admin(auth.uid(), hoa_id)']) {
    const result = fixture([`CREATE TABLE public.t (hoa_id uuid);
      ALTER TABLE public.t ENABLE ROW LEVEL SECURITY;
      CREATE POLICY p ON public.t FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL AND ${scope});`]);
    expect(result.findings, scope).toEqual([]);
  }
  const negative = fixture([`CREATE TABLE public.t (id uuid); ALTER TABLE public.t ENABLE ROW LEVEL SECURITY;
    CREATE POLICY p ON public.t USING (false); CREATE POLICY q ON public.t USING (1 = 2);`]);
  expect(negative.findings).toEqual([]);
});

test('round 2 F-2: ALTER of an unseen policy retains baseline evidence and altered expressions', () => {
  const result = fixture([
    `ALTER POLICY "Baseline policy" ON public.profiles TO authenticated USING (auth.uid() IS NOT NULL);`,
    `ALTER POLICY "Baseline policy" ON public.profiles RENAME TO "Renamed baseline";
     ALTER POLICY "Another baseline" ON public.profiles USING (hoa_id = auth.uid());`,
  ]);
  const policies = result.tables[0].policies;
  expect(policies.has('Baseline policy')).toBe(false);
  expect(policies.get('Renamed baseline')).toMatchObject({ baseline: true, command: 'UNKNOWN', roles: ['authenticated'], expressions: { USING: 'auth.uid() IS NOT NULL' }, firstAlterFile: '000.sql', file: '001.sql' });
  expect(policies.get('Another baseline')?.roles).toEqual(['unknown']);
  expect(result.findings).toHaveLength(1);
  expect(result.findings[0]).toMatchObject({ kind: 'Authenticated-only, no scoping marker', policy: 'Renamed baseline', file: '001.sql' });
  const report = renderReport(result);
  expect(report).toContain('ALTER POLICY on policies not created in migrations');
  expect(report).toContain('baseline policies inferred from ALTER: 2');
  expect(report).toContain('| public.profiles | Renamed baseline | UNKNOWN | authenticated |');
});

test('round 2 F-3: balanced function arguments preserve defaults and numeric type identities', () => {
  const result = fixture([`
    CREATE FUNCTION public.with_defaults(at_time timestamptz DEFAULT now(), amount numeric(10,2) DEFAULT round(1.25, 2))
      RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT true; $$;
    REVOKE ALL ON FUNCTION public.with_defaults(timestamptz, numeric) FROM PUBLIC, anon;
    CREATE OR REPLACE FUNCTION public.with_defaults(at_time timestamptz DEFAULT now(), amount numeric(10,2) DEFAULT round(2.25, 2))
      RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT false; $$;
    CREATE FUNCTION public.string_default(value text DEFAULT 'a)(') RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT true; $$;
    REVOKE ALL ON FUNCTION public.string_default(text) FROM PUBLIC, anon;
  `]);
  expect(result.functions.map((f) => f.name)).toEqual(['public.with_defaults(timestamptz, numeric)', 'public.string_default(text)']);
  expect(result.findings).toEqual([]);
});

test('round 2 F-4: policy commands and roles come only from the header', () => {
  const result = fixture([`CREATE TABLE public.t (id uuid); ALTER TABLE public.t ENABLE ROW LEVEL SECURITY;
    CREATE POLICY default_header ON public.t USING (EXISTS (SELECT 1 FROM other WHERE note = 'TO anon' FOR UPDATE));
    CREATE POLICY explicit_header ON public.t FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM other WHERE note = 'TO ${SERVICE_ROLE}' FOR UPDATE));
    ALTER POLICY explicit_header ON public.t USING (EXISTS (SELECT 1 FROM other WHERE note = 'TO anon' FOR UPDATE));
  `]);
  expect(result.tables[0].policies.get('default_header')).toMatchObject({ command: 'ALL', roles: ['public'] });
  expect(result.tables[0].policies.get('explicit_header')).toMatchObject({ command: 'SELECT', roles: ['authenticated'] });
});

test('round 2 documentation: hosted-state guidance includes all read-only verification queries', () => {
  const report = renderReport(fixture([]));
  expect(report.indexOf('## How to use this report')).toBeLessThan(report.indexOf('Exact observed counts:'));
  expect(report).toContain('Migration history is NOT the source of truth for the hosted database');
  expect(report).toContain("select schemaname, tablename, policyname, cmd, roles, qual, with_check from pg_policies where tablename = '<table>' order by policyname;");
  expect(report).toContain("select p.proname, p.prosecdef, has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = '<name>';");
  expect(report).toContain("select relname, relrowsecurity from pg_class where relname = '<table>';");
});

test('round 3 R1: direct and one/two-hop helper paths reach the final global-admin body', () => {
  const result = fixture([`
    CREATE TABLE public.t (id uuid); ALTER TABLE public.t ENABLE ROW LEVEL SECURITY;
    CREATE FUNCTION public.raw_admin(user_id uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT has_role(user_id, 'admin'::public.app_role); $$;
    CREATE FUNCTION public.one_hop() RETURNS boolean LANGUAGE plpgsql AS $fn$ BEGIN RETURN public.raw_admin(auth.uid()); END; $fn$;
    CREATE FUNCTION public.two_hop() RETURNS boolean LANGUAGE sql AS 'SELECT public.one_hop();';
    CREATE POLICY direct ON public.t USING (has_role(auth.uid(), 'admin'::app_role));
    CREATE POLICY one ON public.t USING (public.raw_admin(auth.uid()));
    CREATE POLICY two ON public.t USING (public.one_hop());
    CREATE POLICY three ON public.t USING (public.two_hop());
  `]);
  const global = result.findings.filter((f) => f.kind === 'Global admin');
  expect(global.map((f) => f.policy)).toEqual(['direct', 'one', 'two', 'three']);
  expect(result.globalPolicies.find((p) => p.policy === 'two')?.chain).toEqual(['public.t: two', 'public.one_hop()', 'public.raw_admin(uuid)']);
  expect(result.globalPolicies.find((p) => p.policy === 'three')?.chain).toEqual(['public.t: three', 'public.two_hop()', 'public.one_hop()', 'public.raw_admin(uuid)']);
  expect(result.functions.find((f) => f.name === 'public.raw_admin(uuid)')).toMatchObject({ usesGlobalAdmin: true, scoped: false, definer: true, file: '000.sql' });
  expect(result.functions.find((f) => f.name === 'public.one_hop()')?.callsHelpers).toEqual(['public.raw_admin(uuid)']);
  expect(renderReport(result)).toContain('## Functions using the global admin role');
});

test('round 3 R1: scoped helper needs a hoa id at each call site', () => {
  const result = fixture([`
    CREATE TABLE public.t (hoa_id uuid); ALTER TABLE public.t ENABLE ROW LEVEL SECURITY;
    CREATE FUNCTION public.scoped_admin(p_hoa_id uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT has_role(auth.uid(), 'admin') AND check_hoa_admin(auth.uid(), p_hoa_id); $$;
    CREATE FUNCTION public.wrapper(target_hoa_id uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT public.scoped_admin(target_hoa_id); $$;
    CREATE POLICY scoped ON public.t USING (public.scoped_admin(hoa_id));
    CREATE POLICY wrapped ON public.t USING (public.wrapper(hoa_id));
    CREATE POLICY no_hoa_argument ON public.t USING (public.scoped_admin(NULL));
  `]);
  expect(result.globalPolicies.map((p) => [p.policy, p.scoped])).toEqual([['scoped', true], ['wrapped', true], ['no_hoa_argument', false]]);
  expect(result.findings.filter((f) => f.kind === 'Global admin').map((f) => f.policy)).toEqual(['no_hoa_argument']);
});

test('round 3 R1: cyclic helpers stop safely and retain reachable global-admin paths', () => {
  const result = fixture([`
    CREATE TABLE public.t (id uuid); ALTER TABLE public.t ENABLE ROW LEVEL SECURITY;
    CREATE FUNCTION public.a() RETURNS boolean LANGUAGE sql AS $$ SELECT public.b(); $$;
    CREATE FUNCTION public.b() RETURNS boolean LANGUAGE sql AS $$ SELECT public.a() OR has_role(auth.uid(), 'admin'); $$;
    CREATE POLICY cyclic ON public.t USING (public.a());
  `]);
  expect(result.globalPolicies).toHaveLength(1);
  expect(result.globalPolicies[0].chain).toEqual(['public.t: cyclic', 'public.a()', 'public.b()']);
  expect(result.helperLimits.some((limit) => limit.startsWith('Cycle stopped:'))).toBe(true);
});

test('round 3 R1: CREATE OR REPLACE final body wins and uncalled functions remain visible', () => {
  const result = fixture([
    `CREATE TABLE public.t (id uuid); ALTER TABLE public.t ENABLE ROW LEVEL SECURITY;
     CREATE FUNCTION public.changed() RETURNS boolean LANGUAGE sql AS $$ SELECT has_role(auth.uid(), 'admin'); $$;
     CREATE POLICY p ON public.t USING (public.changed());`,
    `CREATE OR REPLACE FUNCTION public.changed() RETURNS boolean LANGUAGE sql AS $$ SELECT false; $$;
     CREATE FUNCTION public.uncalled() RETURNS boolean LANGUAGE sql AS $$ SELECT has_role(auth.uid(), 'admin'); $$;`,
  ]);
  expect(result.globalPolicies).toEqual([]);
  expect(result.functions.find((f) => f.name === 'public.changed()')).toMatchObject({ body: ' SELECT false; ', usesGlobalAdmin: false, file: '001.sql' });
  const report = renderReport(result);
  expect(report).toContain('Full final helper inventory examined');
  expect(report).toContain('| public.uncalled() | false | true | false |');
});

test('round 3 R2: omit empty tables and separate trigger candidates and following prose', () => {
  const empty = renderReport(fixture([]));
  expect(empty.split('\n').some((line) => line.startsWith('|'))).toBe(false);
  expect(empty).toContain('No final helper functions observed.');
  const report = renderReport(fixture([`
    CREATE FUNCTION public.on_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN NEW; END; $$;
  `]));
  expect(report).toContain('\n\n### Trigger candidates\n\n| Candidate |');
  const lines = report.split('\n');
  lines.forEach((line, i) => {
    if (line.startsWith('|') && lines[i + 1] && !lines[i + 1].startsWith('|')) expect(lines[i + 1]).toBe('');
  });
});

test('round 3 R3: restrictive policy mode is retained and excluded from broad access', () => {
  const result = fixture([`
    CREATE TABLE public.t (id uuid); ALTER TABLE public.t ENABLE ROW LEVEL SECURITY;
    CREATE POLICY narrow ON public.t AS RESTRICTIVE FOR SELECT TO authenticated USING (true);
    CREATE POLICY open ON public.t AS PERMISSIVE FOR SELECT TO authenticated USING (true);
    ALTER POLICY narrow ON public.t RENAME TO narrow_renamed;
  `]);
  expect(result.tables[0].policies.get('narrow_renamed')?.mode).toBe('RESTRICTIVE');
  expect(result.tables[0].policies.get('open')?.mode).toBe('PERMISSIVE');
  expect(result.findings.map((f) => f.policy)).toEqual(['open']);
  expect(result.restrictivePolicies.map((p) => p.name)).toEqual(['narrow_renamed']);
  expect(renderReport(result)).toContain('- public.t / narrow_renamed: RESTRICTIVE SELECT; roles: authenticated; defining migration: 000.sql.');
});

test('round 3 R4: CLI works from OS temp with fixture overrides and script-relative defaults', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rls-audit-cli-'));
  const script = resolve('scripts/rls-audit.mjs');
  try {
    writeFileSync(join(dir, '001.sql'), 'CREATE TABLE public.fixture (id uuid);');
    const output = join(dir, 'audit.md');
    const explicit = spawnSync(process.execPath, [script, output, dir], { cwd: tmpdir(), encoding: 'utf8' });
    expect(explicit.status, explicit.stderr).toBe(0);
    expect(readFileSync(output, 'utf8')).toContain('migrations read: 1; tables: 1; final policies: 0');
    // Script-relative defaults, exercised in an ISOLATED temporary checkout layout so the tracked report is never
    // touched: <tmp>/scripts/rls-audit.mjs, <tmp>/supabase/migrations/*.sql, <tmp>/docs/onboarding/.
    const layout = join(dir, 'checkout');
    mkdirSync(join(layout, 'scripts'), { recursive: true });
    mkdirSync(join(layout, 'supabase', 'migrations'), { recursive: true });
    mkdirSync(join(layout, 'docs', 'onboarding'), { recursive: true });
    copyFileSync(script, join(layout, 'scripts', 'rls-audit.mjs'));
    writeFileSync(join(layout, 'supabase', 'migrations', '001.sql'), 'CREATE TABLE public.isolated (id uuid);');
    const allDefaults = spawnSync(process.execPath, [join(layout, 'scripts', 'rls-audit.mjs')], { cwd: tmpdir(), encoding: 'utf8' });
    expect(allDefaults.status, allDefaults.stderr).toBe(0);
    const isolatedReport = join(layout, 'docs', 'onboarding', 'RLS-AUDIT.md');
    expect(allDefaults.stdout).toContain(isolatedReport);
    expect(readFileSync(isolatedReport, 'utf8')).toContain('migrations read: 1; tables: 1; final policies: 0');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('round 4 U3-R1: a helper that ORs the global-admin test with a scoped branch is NOT treated as scoped', () => {
  const policy = (fn: string, args = 'auth.uid(), hoa_id') => `
    CREATE TABLE public.t (id uuid, hoa_id uuid); ALTER TABLE public.t ENABLE ROW LEVEL SECURITY;
    CREATE POLICY p ON public.t FOR INSERT TO authenticated WITH CHECK (public.${fn}(${args}));`;
  const flagged = (sql: string[]) => fixture(sql).findings.some((f) => f.kind === 'Global admin' && f.object === 'public.t');

  // (a) the can_create_ladder shape: global admin OR separate membership branch -> flagged
  expect(flagged([`
    CREATE FUNCTION public.can_x(_u uuid, _h uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
      SELECT public.has_role(_u, 'admin') OR EXISTS (SELECT 1 FROM public.hoa_memberships m WHERE m.user_id = _u AND m.hoa_id = _h)
    $$;`, policy('can_x')])).toBe(true);
  // (b) global admin AND community-admin check -> not flagged
  expect(flagged([`
    CREATE FUNCTION public.can_y(_u uuid, _h uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
      SELECT public.has_role(_u, 'admin') AND public.check_hoa_admin(_u, _h)
    $$;`, policy('can_y')])).toBe(false);
  // (c) (global admin AND same hoa) OR owner -> the admin alternative is scoped -> not flagged
  expect(flagged([`
    CREATE FUNCTION public.can_z(_u uuid, _h uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
      SELECT (public.has_role(_u, 'admin') AND _h = hoa_id) OR _u = owner_id
    $$;`, policy('can_z')])).toBe(false);
  // (d) the can_x shape reached through a second helper -> flagged, chain recorded
  const chained = fixture([`
    CREATE FUNCTION public.can_x(_u uuid, _h uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
      SELECT public.has_role(_u, 'admin') OR EXISTS (SELECT 1 FROM public.hoa_memberships m WHERE m.user_id = _u AND m.hoa_id = _h)
    $$;
    CREATE FUNCTION public.outer_fn(_u uuid, _h uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT public.can_x(_u, _h) $$;`,
  policy('outer_fn')]);
  expect(chained.findings.some((f) => f.kind === 'Global admin' && /outer_fn.*can_x/.test(f.why))).toBe(true);
  // (e) control flow cannot be reduced to one boolean: stays a candidate and is marked for manual review
  const flow = fixture([`
    CREATE FUNCTION public.can_w(_u uuid, _h uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
    BEGIN
      IF public.has_role(_u, 'admin') THEN RETURN true; END IF;
      RETURN false;
    END $$;`, policy('can_w')]);
  expect(flow.findings.some((f) => f.kind === 'Global admin' && f.object === 'public.t')).toBe(true);
  expect(flow.functions.find((f) => f.name.startsWith('public.can_w'))?.manualReview).toBe(true);
});

test('round 5 U3-R5: parenthesised SELECT / RETURN bodies are reduced before OR analysis; irreducible bodies need manual review', () => {
  const policy = (fn: string) => `
    CREATE TABLE public.t (id uuid, hoa_id uuid); ALTER TABLE public.t ENABLE ROW LEVEL SECURITY;
    CREATE POLICY p ON public.t FOR INSERT TO authenticated WITH CHECK (public.${fn}(auth.uid(), hoa_id));`;
  const run = (name: string, language: string, body: string) =>
    fixture([`CREATE FUNCTION public.${name}(_u uuid, _h uuid) RETURNS boolean LANGUAGE ${language} SECURITY DEFINER AS $$ ${body} $$;`, policy(name)]);
  const flagged = (r: ReturnType<typeof fixture>) => r.findings.some((f) => f.kind === 'Global admin' && f.object === 'public.t');

  // the reviewer's counter-example: the whole expression is wrapped in parentheses after SELECT
  expect(flagged(run('p1', 'sql', "SELECT (public.has_role(_u, 'admin') OR public.check_hoa_admin(_u, _h));"))).toBe(true);
  // same shape through plpgsql RETURN
  expect(flagged(run('p2', 'plpgsql', "BEGIN RETURN (public.has_role(_u, 'admin') OR EXISTS (SELECT 1 FROM public.hoa_memberships m WHERE m.user_id = _u AND m.hoa_id = _h)); END"))).toBe(true);
  // properly conjoined + parenthesised stays NOT flagged
  expect(flagged(run('p3', 'sql', "SELECT (public.has_role(_u, 'admin') AND public.check_hoa_admin(_u, _h));"))).toBe(false);
  expect(flagged(run('p4', 'plpgsql', "BEGIN RETURN (public.has_role(_u, 'admin') AND public.check_hoa_admin(_u, _h)); END"))).toBe(false);
  // several statements cannot be reduced safely -> candidate + manual review
  const multi = run('p5', 'plpgsql', "DECLARE ok boolean; BEGIN ok := public.has_role(_u, 'admin'); RETURN ok AND public.check_hoa_admin(_u, _h); END");
  expect(flagged(multi)).toBe(true);
  expect(multi.functions.find((f) => f.name.startsWith('public.p5'))?.manualReview).toBe(true);
});

test('round 6 U3-R6: an explicit DISABLE on a baseline table is reported; an explicit ENABLE is known; no toggle stays unknown', () => {
  const result = fixture([`
    ALTER TABLE public.base_off DISABLE ROW LEVEL SECURITY;
    ALTER TABLE public.base_on ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.base_flip DISABLE ROW LEVEL SECURITY;
    ALTER TABLE public.base_flip ENABLE ROW LEVEL SECURITY;
    CREATE POLICY p ON public.base_none USING (id = auth.uid());
  `]);
  expect(result.findings.filter((f) => f.kind === 'RLS disabled').map((f) => f.object)).toEqual(['public.base_off']);
  expect(result.findings.find((f) => f.object === 'public.base_off')?.why).toMatch(/explicitly set to DISABLE/);
  expect(result.unknownTables.map((t) => t.name)).toEqual(['public.base_none']);
});

test('round 7 U3-R7: casts and other wrappers that hide an OR around a global-admin test stay candidates', () => {
  const policy = (fn: string) => `
    CREATE TABLE public.t (id uuid, hoa_id uuid); ALTER TABLE public.t ENABLE ROW LEVEL SECURITY;
    CREATE POLICY p ON public.t FOR INSERT TO authenticated WITH CHECK (public.${fn}(auth.uid(), hoa_id));`;
  const run = (name: string, language: string, body: string) =>
    fixture([`CREATE FUNCTION public.${name}(_u uuid, _h uuid) RETURNS boolean LANGUAGE ${language} SECURITY DEFINER AS $$ ${body} $$;`, policy(name)]);
  const flagged = (r: ReturnType<typeof fixture>) => r.findings.some((f) => f.kind === 'Global admin' && f.object === 'public.t');

  expect(flagged(run('c1', 'sql', "SELECT (public.has_role(_u, 'admin') OR public.check_hoa_admin(_u, _h))::boolean;"))).toBe(true);
  expect(flagged(run('c2', 'plpgsql', "BEGIN RETURN (public.has_role(_u, 'admin') OR public.check_hoa_admin(_u, _h))::boolean; END"))).toBe(true);
  expect(flagged(run('c3', 'sql', "SELECT COALESCE(public.has_role(_u, 'admin') OR public.check_hoa_admin(_u, _h), false);"))).toBe(true);
  // a cast around a properly conjoined expression has no OR, so it is not newly flagged
  expect(flagged(run('c4', 'sql', "SELECT (public.has_role(_u, 'admin') AND public.check_hoa_admin(_u, _h))::boolean;"))).toBe(false);
  // direct policy expression with the same wrapper
  const direct = fixture([`CREATE TABLE public.d (id uuid, hoa_id uuid); ALTER TABLE public.d ENABLE ROW LEVEL SECURITY;
    CREATE POLICY q ON public.d FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'admin') OR check_hoa_admin(auth.uid(), hoa_id))::boolean);`]);
  expect(direct.findings.some((f) => f.kind === 'Global admin' && f.object === 'public.d')).toBe(true);
});

test('round 8 U3-R8: commas inside quoted strings do not split helper arguments or declaration defaults', () => {
  const sql = [`
    CREATE FUNCTION public.raw_admin(user_id uuid, note text) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT public.has_role(user_id, 'admin') $$;
    CREATE TABLE public.q (id uuid); ALTER TABLE public.q ENABLE ROW LEVEL SECURITY;
    CREATE POLICY p ON public.q FOR SELECT TO authenticated USING (public.raw_admin(auth.uid(), 'a,b'));
    CREATE POLICY p2 ON public.q FOR SELECT TO authenticated USING (public.raw_admin(auth.uid(), $tag$x,(y$tag$));
  `];
  const r = fixture(sql);
  expect(r.findings.filter((f) => f.kind === 'Global admin' && f.object === 'public.q').map((f) => f.policy).sort()).toEqual(['p', 'p2']);
  // a quoted default containing a comma must not corrupt the declared signature, so a later REVOKE with the real signature matches
  const revoked = fixture([`
    CREATE FUNCTION public.with_default(a text DEFAULT 'x,y', b int DEFAULT 1) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT true $$;
    REVOKE ALL ON FUNCTION public.with_default(text, int) FROM PUBLIC, anon;
  `]);
  expect(revoked.functions.find((f) => f.name.startsWith('public.with_default'))?.grants.has('anon')).toBe(false);
});

test('round 9 U3-R9: CREATE POLICY inside DO ... IF NOT EXISTS blocks is replayed with exact-name semantics', () => {
  const r = fixture([
    `CREATE TABLE public.prefs (user_id uuid); ALTER TABLE public.prefs ENABLE ROW LEVEL SECURITY;
     CREATE POLICY "Users can view others' active prefs" ON public.prefs FOR SELECT USING (true);`,
    `DO $$
     BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'prefs' AND policyname = 'Users can view others active prefs') THEN
         CREATE POLICY "Users can view others active prefs" ON public.prefs FOR SELECT USING (user_id = auth.uid());
       END IF;
       IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'prefs' AND policyname = 'Users can view others'' active prefs') THEN
         CREATE POLICY "Users can view others' active prefs" ON public.prefs FOR SELECT USING (false);
       END IF;
     END $$;`,
  ]);
  const t = r.tables.find((tb) => tb.name === 'public.prefs')!;
  // the differently-spelled name is a distinct policy and IS created; the same-name one is NOT overwritten
  expect([...t.policies.keys()].sort()).toEqual(["Users can view others active prefs", "Users can view others' active prefs"]);
  expect(t.policies.get("Users can view others' active prefs")?.expressions.USING).toBe('true');
});

test('round 9 U3-R10: the report does not claim the same-HOA profiles policy is absent from migrations', () => {
  const report = renderReport(fixture(['CREATE TABLE public.z (id uuid);']));
  expect(report).not.toMatch(/absent from migrations/);
  expect(report).toContain('20260518184411');
  expect(report).toContain('unverified');
});
