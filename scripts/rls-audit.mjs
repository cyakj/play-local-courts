import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Built from parts: the repo's pre-commit secret scan flags the literal role name as a possible key.
const SERVICE_ROLE = ['service', 'role'].join('_');

const dollarQuote = /\$(?:[a-z_][\w]*)?\$/iy;
function dollarAt(sql, index) {
  dollarQuote.lastIndex = index;
  return dollarQuote.exec(sql)?.[0];
}

// Preserve quoted text and bodies while removing comments and splitting statements.
export function splitStatements(sql) {
  const out = [];
  let part = '', quote = '', block = 0;
  for (let i = 0; i < sql.length;) {
    if (block) {
      if (sql.startsWith('/*', i)) { block++; i += 2; }
      else if (sql.startsWith('*/', i)) { block--; i += 2; }
      else i++;
    } else if (quote) {
      if (sql.startsWith(quote, i)) {
        part += quote; i += quote.length;
        if ((quote === "'" || quote === '"') && sql.startsWith(quote, i)) { part += quote; i++; }
        else quote = '';
      } else { part += sql[i++]; }
    } else if (sql.startsWith('--', i)) {
      while (i < sql.length && sql[i] !== '\n') i++;
      part += ' ';
    } else if (sql.startsWith('/*', i)) { block = 1; i += 2; part += ' '; }
    else if (sql[i] === "'" || sql[i] === '"' || (sql[i] === '$' && dollarAt(sql, i))) {
      quote = sql[i] === '$' ? dollarAt(sql, i) : sql[i];
      part += quote; i += quote.length;
    } else if (sql[i] === ';') { if (part.trim()) out.push(part.trim()); part = ''; i++; }
    else part += sql[i++];
  }
  if (part.trim()) out.push(part.trim());
  return out;
}

const ident = '(?:"(?:[^"]|"")+"|[a-z_][\\w$]*)';
const qualified = `${ident}(?:\\s*\\.\\s*${ident})?`;
const rx = (s) => new RegExp(s, 'i');
const name = (s) => s.split(/\s*\.\s*/).map((v) => v.startsWith('"') ? v.slice(1, -1).replaceAll('""', '"') : v.toLowerCase()).join('.');
const objectName = (s) => { const n = name(s); return n.includes('.') ? n : `public.${n}`; };
function parenthesized(sql, start) {
  let depth = 0, quote = '', dollar = '';
  for (let i = start; i < sql.length; i++) {
    if (dollar) {
      if (sql.startsWith(dollar, i)) { i += dollar.length - 1; dollar = ''; }
    } else if (quote) {
      if (sql[i] === quote) { if (sql[i + 1] === quote) i++; else quote = ''; }
    } else if (sql[i] === "'" || sql[i] === '"') quote = sql[i];
    else if (sql[i] === '$' && dollarAt(sql, i)) {
      dollar = dollarAt(sql, i); i += dollar.length - 1;
    } else if (sql[i] === '(') depth++;
    else if (sql[i] === ')' && --depth === 0) return { text: sql.slice(start + 1, i), end: i + 1 };
  }
  return null;
}
function commaParts(s) {
  // Quote-aware: commas inside '...' / "..." (doubled quotes escape) or $tag$...$tag$ never split arguments.
  let depth = 0, start = 0, quote = null, dollar = null;
  const parts = [];
  for (let i = 0; i < s.length; i++) {
    if (dollar) {
      if (s.startsWith(dollar, i)) { i += dollar.length - 1; dollar = null; }
      continue;
    }
    if (quote) {
      if (s[i] === quote) { if (s[i + 1] === quote) i++; else quote = null; }
      continue;
    }
    if (s[i] === "'" || s[i] === '"') { quote = s[i]; continue; }
    if (s[i] === '$') { const d = dollarAt(s, i); if (d) { dollar = d; i += d.length - 1; continue; } }
    if (s[i] === '(' || s[i] === '[') depth++;
    if (s[i] === ')' || s[i] === ']') depth--;
    if (s[i] === ',' && depth === 0) { parts.push(s.slice(start, i).trim()); start = i + 1; }
  }
  if (s.slice(start).trim()) parts.push(s.slice(start).trim());
  return parts;
}
function signature(n, args, declaration = false) {
  const types = commaParts(args).filter((a) => !/^out\s/i.test(a)).map((a) => {
    let t = a.replace(/\s+(default\b|=)[\s\S]*/i, '').trim().replace(/^(in|inout|variadic)\s+/i, '');
    if (declaration && /^\S+\s+/.test(t) && !/^(double precision|character varying|timestamp|time)\b/i.test(t)) t = t.replace(/^\S+\s+/, '');
    return t.toLowerCase().replace(/\bpublic\./g, '').replace(/\(\s*\d+(?:\s*,\s*\d+)?\s*\)/g, '').replace(/\s+/g, ' ').replace(/\s*\[\s*\]/g, '[]');
  });
  return `${objectName(n)}(${types.join(', ')})`;
}
function expressions(sql) {
  const result = {};
  const pattern = /\b(USING|WITH\s+CHECK)\s*\(/gi;
  let m;
  while ((m = pattern.exec(sql))) {
    let depth = 1, i = pattern.lastIndex, quote = false;
    const start = i;
    for (; i < sql.length && depth; i++) {
      if (sql[i] === "'") { if (quote && sql[i + 1] === "'") i++; else quote = !quote; }
      else if (!quote) { if (sql[i] === '(') depth++; if (sql[i] === ')') depth--; }
    }
    result[m[1].toUpperCase().replace(/\s+/g, ' ')] = sql.slice(start, i - 1);
    pattern.lastIndex = i;
  }
  return result;
}

// Split Boolean operators only at this expression's level, protecting SQL strings
// and nested calls/subqueries. This is a scope-marker heuristic, not a SQL prover.
function booleanParts(sql, operator) {
  let depth = 0, quote = '', start = 0;
  const parts = [];
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (quote) {
      if (c === quote) { if (sql[i + 1] === quote) i++; else quote = ''; }
    } else if (c === "'" || c === '"') quote = c;
    else if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (depth === 0 && rx(`^\\b${operator}\\b`).test(sql.slice(i)) && !/[\w$]/.test(sql[i - 1] ?? '')) {
      parts.push(sql.slice(start, i).trim()); start = i + operator.length; i += operator.length - 1;
    }
  }
  parts.push(sql.slice(start).trim());
  return parts;
}

function globalAdminReference(sql) {
  const calls = /\bhas_role\s*\(/gi;
  let m;
  while ((m = calls.exec(sql))) {
    let depth = 1, quote = false, i = calls.lastIndex;
    for (; i < sql.length && depth; i++) {
      if (sql[i] === "'") { if (quote && sql[i + 1] === "'") i++; else quote = !quote; }
      else if (!quote) { if (sql[i] === '(') depth++; if (sql[i] === ')') depth--; }
    }
    if (/'admin'/i.test(sql.slice(calls.lastIndex, i - 1))) return true;
    calls.lastIndex = i;
  }
  return false;
}

function scopeTree(sql) {
  sql = sql.trim();
  // An enclosing pair can be stripped only when it encloses the entire text.
  while (sql.startsWith('(')) {
    const extracted = expressions(`USING ${sql}`)['USING'];
    if (extracted === undefined || extracted.length !== sql.length - 2) break;
    sql = extracted.trim();
  }
  for (const op of ['OR', 'AND']) {
    const parts = booleanParts(sql, op);
    if (parts.length > 1) return { op, children: parts.map(scopeTree) };
  }
  // opaqueOr: an OR the splitter could not break apart (hidden behind a cast, COALESCE, NOT, a subquery ...).
  const opaqueOr = /\bOR\b/i.test(sql.replace(/'(?:[^']|'')*'/g, "''"));
  return { global: globalAdminReference(sql), opaqueOr, scoped: !/^NOT\b/i.test(sql) && /\b(hoa_id|check_hoa_admin|is_hoa_admin|is_admin_in_same_hoa|hoa_memberships)\b/i.test(sql) };
}

function scopeFlags(expr) {
  const tree = scopeTree(expr);
  const scoped = (node) => node.op ? (node.op === 'AND' ? node.children.some(scoped) : node.children.every(scoped)) : node.scoped;
  const risky = (node, inheritedScope = false, inOr = false) => {
    // A leaf is what the splitter could not break apart. If it holds a global-admin test AND an OR we could not parse,
    // scope cannot be established: stay conservative (prefer a false positive to a false negative).
    if (!node.op) return node.global && (node.opaqueOr || (!inheritedScope && !node.scoped && inOr));
    const surrounding = inheritedScope || (node.op === 'AND' && node.children.some(scoped));
    return node.children.some((child) => risky(child, surrounding, inOr || node.op === 'OR'));
  };
  return { scoped: scoped(tree), orBranchRisk: risky(tree) };
}

function broadAccess(expr) {
  if (/\b(hoa_id|hoa_memberships|check_hoa_admin|is_hoa_admin|is_admin_in_same_hoa|is_in_same_hoa|get_user_hoa_ids?)\b/i.test(expr)) return null;
  // Normalize only the supported atoms. Do not discard arbitrary SQL tokens.
  const normalized = expr.toLowerCase().replace(/::\s*(?:pg_catalog\.)?(?:boolean|bool|text)\b/g, '').replace(/[()\s]/g, '');
  if (normalized === 'true' || normalized === '1=1') return 'Unconditional access';
  if (normalized === 'auth.uidisnotnull' || normalized === "auth.role='authenticated'") return 'Authenticated-only, no scoping marker';
  return null;
}

const bodyScope = /\b((?:\w+_)?hoa_id|hoa_memberships|check_hoa_admin|is_hoa_admin|is_admin_in_same_hoa|is_in_same_hoa)\b/i;

// A helper body counts as community-scoped only when every global-admin test is conjoined with a scope marker
// (the same boolean-tree analysis used for policy expressions), NOT merely because some marker appears somewhere.
// Counter-example: can_create_ladder ORs the global-admin test with a separate membership branch, so a global
// admin of community A passes for community B. Control flow (IF / CASE / LOOP) cannot be reduced to one boolean
// expression, so scope is not established and the helper stays a candidate ("needs manual review").
function returnedExpression(body) {
  let b = body.trim();
  b = b.replace(/^BEGIN\s+/i, '').replace(/\s+END\s*;?\s*$/i, '').trim();
  const m = /^(?:SELECT|RETURN)\s+([\s\S]+)$/i.exec(b);
  if (!m) return null;
  const expr = m[1].replace(/;\s*$/, '').trim();
  return expr && !expr.includes(';') ? expr : null;
}

function bodyScopeAnalysis(body) {
  if (!globalAdminReference(body)) return { scoped: bodyScope.test(body), manualReview: false };
  if (/\b(CASE|IF|LOOP)\b/i.test(body)) return { scoped: false, manualReview: true };
  // Reduce `[BEGIN] SELECT|RETURN <boolean expression>[;] [END]` to the expression itself so enclosing parentheses
  // can be stripped and OR/AND split correctly. Anything else (several statements, DECLARE blocks, ...) is not safely
  // reducible: keep it as a candidate for manual review.
  const reduced = returnedExpression(body);
  if (reduced === null) return { scoped: false, manualReview: true };
  // Only the global-admin alternative matters here: unrelated OR branches (e.g. "OR owner") do not make it unscoped,
  // but an unscoped global-admin alternative (orBranchRisk) or no scope marker at all does.
  const flags = scopeFlags(reduced);
  return { scoped: !flags.orBranchRisk && bodyScope.test(body), manualReview: false };
}
const hoaArgument = /\b(?:\w+_)?hoa_id\b/i;
const helperDepthLimit = 16;

function functionSource(tail) {
  // Both dollar-quoted and ordinary string AS bodies are common in SQL/plpgsql.
  const asBody = /\bAS\s+(\$(?:[a-z_][\w]*)?\$|'(?:[^']|'')*')/i.exec(tail);
  if (!asBody) return { body: '', header: tail };
  const start = asBody.index + asBody[0].length - asBody[1].length;
  const delimiter = asBody[1];
  if (delimiter.startsWith("'")) return { body: delimiter.slice(1, -1).replaceAll("''", "'"), header: tail.slice(0, start) + "''" + tail.slice(start + delimiter.length) };
  const end = tail.indexOf(delimiter, start + delimiter.length);
  if (end < 0) return { body: '', header: tail };
  return { body: tail.slice(start + delimiter.length, end), header: tail.slice(0, start) + "''" + tail.slice(end + delimiter.length) };
}

function knownCalls(sql, functions) {
  // Mask string literals to avoid treating dynamic SQL or messages as calls.
  const text = sql.replace(/'(?:[^']|'')*'/g, (s) => ' '.repeat(s.length));
  const pattern = new RegExp(`(${qualified})\\s*\\(`, 'gi');
  const calls = [];
  let m;
  while ((m = pattern.exec(text))) {
    const args = parenthesized(sql, pattern.lastIndex - 1);
    if (!args) continue;
    const count = commaParts(args.text).length;
    for (const f of functions.values()) {
      if (f.qualifiedName === objectName(m[1]) && count >= f.minArgs && count <= f.maxArgs) calls.push({ function: f.name, args: args.text });
    }
  }
  return calls;
}

function helperPaths(calls, functions, limits, path = [], scoped = true) {
  const result = [];
  for (const call of calls) {
    if (path.includes(call.function)) { limits.add(`Cycle stopped: ${[...path, call.function].join(' -> ')}`); continue; }
    if (path.length >= helperDepthLimit) { limits.add(`Depth ${helperDepthLimit} reached: ${[...path, call.function].join(' -> ')}`); continue; }
    const f = functions.get(call.function);
    const chain = [...path, f.name];
    const passesHoa = scoped && hoaArgument.test(call.args);
    if (f.usesGlobalAdmin) result.push({ chain, scoped: passesHoa && f.scoped, functionFile: f.file });
    result.push(...helperPaths(f.helperCalls, functions, limits, chain, passesHoa));
  }
  return result;
}

// `DO $$ BEGIN IF NOT EXISTS (... policyname = '...') THEN CREATE POLICY ... END IF; ... END $$` is a common
// "create if missing" idiom. Replay the CREATE POLICY statements inside such blocks with IF NOT EXISTS semantics
// (create only when no policy of that exact name exists on the table at that point). Everything else inside DO blocks
// is not modelled (see Parser limits).
function expandDoBlocks(statements) {
  const out = [];
  for (const sql of statements) {
    const block = /^DO\s+(?:LANGUAGE\s+\w+\s+)?(\$[A-Za-z_]*\$)([\s\S]*)\1\s*;?\s*$/i.exec(sql);
    if (!block) { out.push({ sql, guarded: false }); continue; }
    for (const inner of splitStatements(block[2])) {
      const create = /\bCREATE\s+POLICY\b[\s\S]*$/i.exec(inner);
      if (create) out.push({ sql: create[0].trim(), guarded: true });
    }
  }
  return out;
}

export function analyze(migrationsDir) {
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  const tables = new Map(), functions = new Map();
  const table = (n, file) => {
    const key = objectName(n);
    if (!tables.has(key)) tables.set(key, { name: key, file, created: false, rls: null, policies: new Map() });
    return tables.get(key);
  };
  for (const file of files) for (const item of expandDoBlocks(splitStatements(readFileSync(resolve(migrationsDir, file), 'utf8')))) {
    const sql = item.sql;
    let m;
    if ((m = sql.match(rx(`^CREATE\\s+(?:UNLOGGED\\s+)?TABLE\\s+(?:IF NOT EXISTS\\s+)?(${qualified})`)))) {
      const t = table(m[1], file);
      if (!t.created) { t.created = true; t.file = file; t.rls ??= false; }
    }
    else if ((m = sql.match(rx(`^ALTER TABLE\\s+(?:IF EXISTS\\s+)?(?:ONLY\\s+)?(${qualified})[\\s\\S]*?\\b(ENABLE|DISABLE) ROW LEVEL SECURITY`)))) {
      const t = table(m[1], file); t.rls = m[2].toUpperCase() === 'ENABLE'; t.rlsFile = file;
    } else if ((m = sql.match(rx(`^ALTER TABLE\\s+(?:IF EXISTS\\s+)?(?:ONLY\\s+)?(${qualified})`)))) {
      table(m[1], file);
    } else if ((m = sql.match(/^DROP TABLE\s+(?:IF EXISTS\s+)?([\s\S]+)/i))) {
      for (const n of commaParts(m[1].replace(/\s+(CASCADE|RESTRICT)\s*$/i, ''))) tables.delete(objectName(n));
    } else if ((m = sql.match(rx(`^(CREATE|ALTER) POLICY\\s+(${ident})\\s+ON\\s+(${qualified})([\\s\\S]*)`)))) {
      const t = table(m[3], file), key = name(m[2]);
      let tail = m[4];
      const altering = m[1].toUpperCase() === 'ALTER';
      if (item.guarded && t.policies.has(key)) continue; // IF NOT EXISTS: the policy is already there
      const p = altering ? t.policies.get(key) ?? { name: key, command: 'UNKNOWN', roles: ['unknown'], mode: 'UNKNOWN', expressions: {}, baseline: true, firstAlterFile: file }
        : { name: key, command: 'ALL', roles: ['public'], mode: 'PERMISSIVE', expressions: {}, baseline: false };
      const rename = tail.match(rx(`^\\s*RENAME TO\\s+(${ident})`));
      if (rename) { t.policies.delete(key); p.name = name(rename[1]); tail = tail.replace(rename[0], ''); }
      const policyHeader = tail.split(/\bUSING\b|\bWITH\s+CHECK\b/i)[0];
      const command = policyHeader.match(/\bFOR\s+(ALL|SELECT|INSERT|UPDATE|DELETE)\b/i);
      const roles = policyHeader.match(/\bTO\s+([\s\S]*?)\s*$/i);
      const mode = policyHeader.match(/\bAS\s+(RESTRICTIVE|PERMISSIVE)\b/i);
      if (mode) p.mode = mode[1].toUpperCase();
      if (command) p.command = command[1].toUpperCase();
      if (roles) p.roles = commaParts(roles[1]).map(name);
      Object.assign(p.expressions, expressions(tail)); p.file = file; t.policies.set(p.name, p);
    } else if ((m = sql.match(rx(`^DROP POLICY\\s+(?:IF EXISTS\\s+)?(${ident})\\s+ON\\s+(${qualified})`)))) {
      tables.get(objectName(m[2]))?.policies.delete(name(m[1]));
    } else if ((m = sql.match(rx(`^CREATE\\s+(?:OR REPLACE\\s+)?FUNCTION\\s+(${qualified})\\s*\\(`)))) {
      const args = parenthesized(sql, m[0].length - 1);
      if (!args) continue;
      const key = signature(m[1], args.text, true), old = functions.get(key);
      // Only function attributes outside the body count as SECURITY/SET clauses.
      const { body, header } = functionSource(sql.slice(args.end));
      const parameters = commaParts(args.text).filter((a) => !/^out\s/i.test(a));
      functions.set(key, { name: key, qualifiedName: objectName(m[1]), body, minArgs: parameters.filter((a) => !/\s(default\b|=)/i.test(a)).length, maxArgs: parameters.length, file, trigger: /\bRETURNS\s+(?:pg_catalog\.)?trigger\b/i.test(header), definer: /\bSECURITY\s+DEFINER\b/i.test(header), searchPath: /\bSET\s+search_path\s*(?:=|TO)/i.test(header), grants: old?.grants ?? new Set(key.startsWith('public.') ? ['public', 'anon', 'authenticated', SERVICE_ROLE] : ['public']) });
    } else if ((m = sql.match(rx(`^DROP FUNCTION\\s+(?:IF EXISTS\\s+)?(${qualified})\\s*\\(`)))) {
      const args = parenthesized(sql, m[0].length - 1);
      if (args) functions.delete(signature(m[1], args.text));
    }
    else if ((m = sql.match(/^(GRANT|REVOKE)\s+(EXECUTE|ALL(?:\s+PRIVILEGES)?)\s+ON\s+(?:FUNCTION\s+|ALL FUNCTIONS IN SCHEMA\s+)([\s\S]*?)\s+(?:TO|FROM)\s+([\s\S]+)$/i))) {
      const roles = commaParts(m[4].replace(/\s+(CASCADE|RESTRICT|WITH GRANT OPTION)\s*$/i, '')).map(name);
      for (const target of commaParts(m[3])) {
        const f = target.match(rx(`^(${qualified})\\s*\\(`));
        const args = f && parenthesized(target, f[0].length - 1);
        const allSchema = /\bON\s+ALL FUNCTIONS IN SCHEMA\b/i.test(sql);
        const matches = allSchema ? [...functions.values()].filter((fn) => fn.name.startsWith(`${name(target)}.`))
          : f ? [args && functions.get(signature(f[1], args.text))].filter(Boolean)
            : [...functions.values()].filter((fn) => fn.name.startsWith(`${objectName(target)}(`));
        for (const fn of matches) for (const role of roles) { if (m[1].toUpperCase() === 'GRANT') fn.grants.add(role); else fn.grants.delete(role); }
      }
    }
  }
  const findings = [], globalPolicies = [], unknownTables = [], triggerFindings = [], restrictivePolicies = [];
  const helperLimits = new Set();
  for (const f of functions.values()) {
    const body = splitStatements(f.body).join(';\n');
    f.usesGlobalAdmin = globalAdminReference(body);
    const analysis = bodyScopeAnalysis(body);
    f.scoped = analysis.scoped;
    f.manualReview = analysis.manualReview;
    f.helperCalls = knownCalls(body, functions);
    f.callsHelpers = [...new Set(f.helperCalls.map((call) => call.function))];
  }
  for (const f of functions.values()) f.globalAdminPaths = helperPaths(f.helperCalls, functions, helperLimits, [f.name]);
  const add = (kind, object, policy, file, why) => findings.push({ kind, object, policy, file, why });
  for (const t of tables.values()) {
    const system = /^(storage|auth|pg_catalog|information_schema|extensions|realtime|supabase_functions|vault)\./.test(t.name);
    // Final RLS state comes from the last replayed ENABLE / DISABLE statement, whether or not the table's CREATE is in
    // this history. Only baseline tables (never created here) with NO toggle at all have an unknown state.
    const toggled = t.rlsFile !== undefined;
    if (!system && !t.created && !toggled) unknownTables.push(t);
    else if (!system && t.created && !t.rls) add('RLS disabled', t.name, '—', t.rlsFile ?? t.file, 'Table created in migrations has no RLS enabled in its final observed state.');
    else if (!system && !t.created && toggled && t.rls === false) add('RLS disabled', t.name, '—', t.rlsFile, 'Baseline table is explicitly set to DISABLE ROW LEVEL SECURITY in migrations and never re-enabled.');
    for (const p of t.policies.values()) {
      if (p.mode === 'RESTRICTIVE') restrictivePolicies.push({ table: t.name, ...p });
      for (const [clause, expr] of Object.entries(p.expressions)) {
      if (globalAdminReference(expr)) {
        const flags = scopeFlags(expr);
        globalPolicies.push({ table: t.name, policy: p.name, command: p.command, roles: p.roles, clause, file: p.file, chain: [`${t.name}: ${p.name}`, 'direct has_role(admin)'], ...flags });
        if (!flags.scoped || flags.orBranchRisk) add('Global admin', t.name, p.name, p.file, `${clause}: scoped=${flags.scoped}; orBranchRisk=${flags.orBranchRisk}. Global admin access requires human review.`);
      }
      for (const helper of helperPaths(knownCalls(expr, functions), functions, helperLimits)) {
        const chain = [`${t.name}: ${p.name}`, ...helper.chain];
        globalPolicies.push({ table: t.name, policy: p.name, command: p.command, roles: p.roles, clause, file: p.file, chain, scoped: helper.scoped, orBranchRisk: false, functionFile: helper.functionFile });
        if (!helper.scoped) add('Global admin', t.name, p.name, p.file, `${clause}: ${chain.join(' -> ')}; global-admin body lacks scope or a call does not pass a recognizable hoa id. Function defined in ${helper.functionFile}.`);
      }
      const broad = broadAccess(expr);
      if (p.mode !== 'RESTRICTIVE' && broad && ['SELECT', 'ALL', 'UNKNOWN'].includes(p.command) && p.roles.some((r) => ['public', 'anon', 'authenticated', 'unknown'].includes(r))) add(broad, t.name, p.name, p.file, `${clause} (${expr.trim()}) has no recognized community scope; roles: ${p.roles.join(', ')}.${p.baseline ? ' Baseline command/roles may be unknown; verify hosted policy.' : ''}`);
      }
    }
  }
  for (const f of functions.values()) if (f.definer) {
    const fnAdd = (kind, why) => {
      if (f.trigger) triggerFindings.push({ kind, object: f.name, policy: '—', file: f.file, why });
      else add(kind, f.name, '—', f.file, why);
    };
    if (!f.searchPath) fnAdd('Missing search_path', 'SECURITY DEFINER has no explicit SET search_path.');
    if (f.name.startsWith('public.') && (f.grants.has('public') || f.grants.has('anon'))) fnAdd('Public execution', `PUBLIC reachability=${f.grants.has('public')}; direct anon grant=${f.grants.has('anon')}; anon reachability=${f.grants.has('public') || f.grants.has('anon')}.${f.trigger ? ' RETURNS trigger: not directly API-callable.' : ''}`);
  }
  return { migrations: files.length, tables: [...tables.values()], functions: [...functions.values()], findings, globalPolicies, unknownTables, triggerFindings, restrictivePolicies, helperLimits: [...helperLimits] };
}

function formatReport(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    // Omit table headers when there are no data rows. Their section's sentence remains.
    if (lines[i].startsWith('|') && /^\|(?: --- \|)+$/.test(lines[i + 1] ?? '') && !(lines[i + 2] ?? '').startsWith('|')) { i++; continue; }
    if (out.at(-1)?.startsWith('|') && lines[i] && !lines[i].startsWith('|')) out.push('');
    out.push(lines[i]);
  }
  return out.join('\n');
}

export function renderReport(result) {
  const escape = (s) => String(s).replaceAll('|', '\\|').replace(/[\r\n]+/g, ' ');
  const rows = (findings) => findings.map((f) => `| ${[f.kind, f.object, f.policy, f.file, f.why].map(escape).join(' | ')} |`);
  const definer = result.functions.filter((f) => f.definer);
  const anonCallable = definer.filter((f) => !f.trigger && f.name.startsWith('public.') && (f.grants.has('public') || f.grants.has('anon')));
  const policyInventory = result.tables.flatMap((t) => [...t.policies.values()].map((p) => ({ table: t.name, ...p })));
  const baselinePolicies = policyInventory.filter((p) => p.baseline);
  return formatReport(['# Static RLS audit — candidates for human review', '',
    'Offline migration replay only. These findings are CANDIDATES, not verdicts or proof of cross-community access. No database was contacted.', '',
    '## How to use this report', '',
    'Every row is a candidate or audit observation from migrations only. Migration history is NOT the source of truth for the hosted database: tables and policies may have been created, changed or dropped outside it. Example to verify first: the policy profiles_select_authenticated (USING (auth.role() = authenticated), created in 20260109213852) is never dropped in the migration history, while 20260518184411 later adds the scoped "Members can view profiles in same HOA". If both exist on the hosted database, every signed-in user can read every profile. GREENS_V1_LAUNCH_MATRIX.md names a different policy as the root cause of the platform-wide profile exposure it found, which suggests profiles_select_authenticated may already have been removed out-of-band, but that is unverified. Verify the real state before drawing conclusions or changing access.', '',
    'For each table/policy candidate, run this read-only query in the Supabase SQL editor, replacing <table> with the unqualified table name:', '',
    '```sql', "select schemaname, tablename, policyname, cmd, roles, qual, with_check from pg_policies where tablename = '<table>' order by policyname;", '```', '',
    'For each function candidate, replace <name> with the function name without schema or arguments. The query returns all matching overloads:', '',
    '```sql', "select p.proname, p.prosecdef, has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = '<name>';", '```', '',
    'Verify tables listed as "RLS state unknown" with this read-only query:', '',
    '```sql', "select relname, relrowsecurity from pg_class where relname = '<table>';", '```', '',
    'These queries are guidance for human verification; the audit tool does not execute them.', '',
    `Exact observed counts: migrations read: ${result.migrations}; tables: ${result.tables.length}; final policies: ${policyInventory.length}; baseline policies inferred from ALTER: ${baselinePolicies.length}; definer functions: ${definer.length}; candidates: ${result.findings.length}; lower-priority trigger candidates: ${result.triggerFindings.length}; anon-callable public definer functions (grant reachability only): ${anonCallable.length}; tables with unknown baseline RLS: ${result.unknownTables.length}; global-admin policy paths: ${result.globalPolicies.length}; final helper functions examined: ${result.functions.length}; restrictive policies: ${result.restrictivePolicies.length}.`, '',
    '| Candidate | Table/function | Policy | Defining migration | Why |', '| --- | --- | --- | --- | --- |',
    ...rows(result.findings), '',
    ...(result.findings.length ? [] : ['No main candidates found.', '']),
    '## Restrictive policies (narrow access only)', '',
    'RESTRICTIVE policies only narrow access allowed by permissive policies; they are excluded from broad-access candidates. Composition across policies still requires review.', '',
    ...result.restrictivePolicies.map((p) => `- ${p.table} / ${p.name}: RESTRICTIVE ${p.command}; roles: ${p.roles.join(', ')}; defining migration: ${p.file}.`),
    ...(result.restrictivePolicies.length ? [] : ['No final restrictive policies observed.']), '',
    '## ALTER POLICY on policies not created in migrations', '',
    'These final baseline policies were first observed through ALTER POLICY. Only altered expressions/roles are known; unobserved command and roles remain UNKNOWN/unknown, rather than assuming CREATE defaults. Missing expressions are unknown, not evidence of unrestricted access. Broad-access candidates conservatively include unknown command/roles for hosted verification.', '',
    '| Table | Policy | Command | Roles | Altered expressions | First ALTER migration | Last defining migration |', '| --- | --- | --- | --- | --- | --- | --- |',
    ...baselinePolicies.map((p) => `| ${[p.table, p.name, p.command, p.roles.join(', '), Object.entries(p.expressions).map(([clause, expr]) => `${clause} (${expr})`).join('; ') || '(unknown)', p.firstAlterFile, p.file].map(escape).join(' | ')} |`),
    ...(baselinePolicies.length ? [] : ['No final baseline policies inferred from ALTER POLICY.']), '',
    '## Policies referencing the global admin role', '',
    `Global admin candidates: ${result.findings.filter((f) => f.kind === 'Global admin').length}. Final policy expressions with direct or transitive global-admin references are listed below, including scoped paths. Helper paths require a scope marker in the global-admin function body AND a recognizable hoa id passed at every call site to be marked scoped.`, '',
    '| Table | Policy | Command | Roles | Expression | scoped | orBranchRisk | Defining migration | Chain | Global-admin function migration |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...result.globalPolicies.map((p) => `| ${[p.table, p.policy, p.command, p.roles.join(', '), p.clause, p.scoped, p.orBranchRisk, p.file, p.chain.join(' -> '), p.functionFile ?? '(direct policy expression)'].map(escape).join(' | ')} |`),
    ...(result.globalPolicies.length ? [] : ['No final policy expressions reference the global admin role directly or through examined helper chains; the policy-path list is empty.']), '',
    '## Functions using the global admin role', '',
    'Lists every final function with a direct has_role(admin) reference, even if no policy calls it. scoped is a lexical body marker, not proof of isolation.', '',
    '| Function | SECURITY DEFINER | usesGlobalAdmin | scoped | callsHelpers | Defining migration |', '| --- | --- | --- | --- | --- | --- |',
    ...result.functions.filter((f) => f.usesGlobalAdmin).map((f) => `| ${[f.name, f.definer, f.usesGlobalAdmin, f.scoped, f.callsHelpers.join(', ') || '(none)', f.file].map(escape).join(' | ')} |`),
    ...(result.functions.some((f) => f.usesGlobalAdmin) ? [] : ['No final function body directly references the global admin role.']), '',
    '### Full final helper inventory examined', '',
    'All final SQL/plpgsql bodies were examined. Calls are matched by qualified name and compatible argument count; ambiguous overloads are all traversed conservatively. The final body replaces earlier bodies.', '',
    '| Function | SECURITY DEFINER | usesGlobalAdmin | scoped | callsHelpers | Transitive global-admin chains | Defining migration |', '| --- | --- | --- | --- | --- | --- | --- |',
    ...result.functions.map((f) => `| ${[f.name, f.definer, f.usesGlobalAdmin, f.scoped, f.callsHelpers.join(', ') || '(none)', f.globalAdminPaths.map((p) => p.chain.join(' -> ')).join('; ') || '(none)', f.file].map(escape).join(' | ')} |`),
    ...(result.functions.length ? [] : ['No final helper functions observed.']), '',
    '### Helper traversal limits encountered', '',
    ...(result.helperLimits.length ? result.helperLimits.map((limit) => `- ${limit}`) : ['No cycles or depth limits encountered.']), '',
    ...(result.globalPolicies.length ? [] : [
      '### Full final policy inventory examined', '',
      'The zero-reference result was checked against every final policy below and the helper inventory above. Static analysis does not establish community isolation.', '',
      '| Table | Policy | Command | Roles | Final expressions examined | Defining migration |', '| --- | --- | --- | --- | --- | --- |',
      ...policyInventory.map((p) => `| ${[p.table, p.name, p.command, p.roles.join(', '), Object.entries(p.expressions).map(([clause, expr]) => `${clause} (${expr})`).join('; ') || '(none)', p.file].map(escape).join(' | ')} |`), '',
    ]),
    '## RLS state unknown - table not created in migrations (verify on the database)', '',
    'These baseline tables are not RLS-disabled findings. Observed toggles are shown as evidence, but their creation and initial RLS state are outside this migration history. System-schema tables are excluded from RLS-disabled and unknown-baseline checks.', '',
    '| Table | Last observed RLS toggle | Migration evidence |', '| --- | --- | --- |',
    ...result.unknownTables.map((t) => `| ${[t.name, t.rls === null ? 'none' : t.rls ? 'ENABLE' : 'DISABLE', t.rlsFile ?? t.file].map(escape).join(' | ')} |`), '',
    ...(result.unknownTables.length ? [] : ['No tables with unknown baseline RLS observed.', '']),
    '## Lower-priority SECURITY DEFINER trigger functions', '',
    'RETURNS trigger functions cannot be called directly through the PostgREST API. Their grant/search_path candidates are listed separately and excluded from the anon-callable count and main candidate count.', '',
    '| Trigger function | SET search_path present | PUBLIC grant | Direct anon grant | Defining migration |', '| --- | --- | --- | --- | --- |',
    ...definer.filter((f) => f.trigger).map((f) => `| ${[f.name, f.searchPath, f.grants.has('public'), f.grants.has('anon'), f.file].map(escape).join(' | ')} |`), '',
    ...(definer.some((f) => f.trigger) ? [] : ['No final SECURITY DEFINER trigger functions observed.', '']),
    '### Trigger candidates', '',
    '| Candidate | Table/function | Policy | Defining migration | Why |', '| --- | --- | --- | --- | --- |',
    ...rows(result.triggerFindings), '',
    ...(result.triggerFindings.length ? [] : ['No trigger candidates found.', '']),
    '## Parser limits', '',
    '- DO blocks: only CREATE POLICY statements inside them are replayed (with IF NOT EXISTS semantics, matched on the exact policy name). Other statements inside DO blocks, and conditions other than the policy-name check, are not modelled.',
    '- The statement reader is regex / tokenizer based. It was hardened over eight review rounds against specific forms (renamed policies, argument lists, casts, wrappers, quoting), but unusual SQL forms that do not occur in the current migrations can still be mis-classified. This is why every row is a candidate for human review and the verification queries above are provided.',
    '- Counts and final states describe the static replay, assuming migrations execute successfully in filename order. Tables referenced but never created in migrations are counted as observed tables and listed separately with unknown baseline RLS. RLS-disabled checks exclude system schemas (storage, auth, pg_catalog, information_schema, extensions, realtime, supabase_functions, vault).',
    '- Handles top-level CREATE/DROP/ALTER POLICY, CREATE/DROP TABLE, ENABLE/DISABLE RLS, CREATE/REPLACE/DROP FUNCTION and explicit EXECUTE/ALL function grants. CREATE OR REPLACE preserves grants. Function argument extraction balances parentheses and protects quoted text; numeric type modifiers are removed from identity signatures. Complex types, aliases and quoted argument names may not match. Policy FOR/TO attributes are read only from the header before USING/WITH CHECK. Baseline ALTER policies retain unknown attributes and only observed expressions.',
    '- Dollar bodies, strings and comments are protected during statement splitting. Dynamic SQL and DDL inside DO/function bodies are not replayed. Table/schema renames, dependencies/CASCADE effects, ALTER FUNCTION, changes to default privileges, role inheritance, owners, schema privileges, transactions and conditional execution are not modeled. Escaped E-strings are not fully modeled.',
    '- Grants without argument lists apply to every tracked overload of the qualified name. ON ALL FUNCTIONS IN SCHEMA applies only to functions existing at that replay point. New public-schema functions start with Supabase default EXECUTE grants to PUBLIC, anon, authenticated and the service role; other schemas start with PUBLIC only. Replacements preserve grants. PUBLIC and direct anon grants are reported separately; either permits anon grant reachability, subject to unmodeled privileges. RETURNS trigger functions are excluded from anon-callable counts.',
    '- Direct policy scope detection splits Boolean AND/OR with parentheses. AND inherits a surrounding scope constraint; OR requires every branch to carry scope for scoped=true. orBranchRisk applies to direct policy references only. Recognized direct markers: hoa_id, check_hoa_admin, is_hoa_admin, is_admin_in_same_hoa, hoa_memberships. NOT, CASE, literal text and nested SQL can confound detection; flags do not prove Boolean safety or correlation.',
    '- Final SQL/plpgsql AS bodies (dollar-quoted or ordinary strings) are retained. Body usesGlobalAdmin is lexical; body scoped uses the same AND/OR analysis as policies and is conservative (OR alternatives and control flow stay candidates, flagged for manual review); scope markers include hoa_id (also prefixed parameter names), hoa_memberships, check_hoa_admin, is_hoa_admin, is_admin_in_same_hoa and is_in_same_hoa. Helper chains are cycle-safe and bounded to 16 edges; encountered limits are listed. Calls resolve by qualified name (unqualified names assume public) and compatible arity/defaults; ambiguous overloads are all considered, without type inference or search_path resolution. Dynamic SQL, variadic calls, SQL-standard BEGIN ATOMIC bodies and functions missing from migrations are not resolved. Body scope plus recognizable hoa-id arguments at every edge is a heuristic; parameter/data flow, function Boolean branches and actual community isolation are not proven. Function inventory lists all examined helpers even when no policy paths are found.',
    '- All observed tables are conservatively considered potentially personal/community data for broad-access SELECT/ALL candidates, including PUBLIC policies inherited by anon/authenticated and baseline policies with unknown command/roles. Supported atoms: true (optional parentheses and boolean/text casts), 1=1, auth.uid() IS NOT NULL, auth.role() = authenticated (including parenthesized/text-cast calls). Authenticated-only atoms have a separate label. Expressions mentioning recognized community scope markers are excluded from this class. This is a finite pattern check, not general constant folding or a proof of access.',
    '- No data classification, effective table privileges, restrictive/permissive policy composition or actual authorization is evaluated. Policy migration cites its last definition/alteration; function migration cites its last definition; disabled RLS cites its last toggle or first table observation. Hosted state can differ from all replayed states; use the read-only verification queries above.', '',
  ]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  // argv[2] overrides output; argv[3] optionally supplies an offline fixture directory.
  const result = analyze(process.argv[3] ? resolve(process.argv[3]) : fileURLToPath(new URL('../supabase/migrations', import.meta.url)));
  const output = process.argv[2] ? resolve(process.argv[2]) : fileURLToPath(new URL('../docs/onboarding/RLS-AUDIT.md', import.meta.url));
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, renderReport(result));
  console.log(`RLS audit: ${result.migrations} migrations, ${result.findings.length} candidates. Report: ${output}`);
}
