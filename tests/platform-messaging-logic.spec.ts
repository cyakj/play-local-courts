/**
 * Node-only logic/source-contract tests for the Platform Admin + community messaging work.
 *   npx playwright test -c playwright.logic.config.ts
 *
 * Database behaviour (RLS, RPC authorisation, approval) is covered by
 * supabase/tests/platform_approval_and_messaging.sql; these tests pin the client-side contracts.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isCMRoutable, isPlatformReviewerRoutable } from '../src/lib/roleRouting';
import { ROLE_LABEL, roleText } from '../src/lib/platformApplications';

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');

test.describe('role routing', () => {
  test('platform_reviewer is recognised and is not a community-admin role', () => {
    expect(isPlatformReviewerRoutable(['platform_reviewer'])).toBe(true);
    expect(isPlatformReviewerRoutable(['admin', 'resident'])).toBe(false);
    expect(isPlatformReviewerRoutable([])).toBe(false);
    expect(isCMRoutable(['platform_reviewer'])).toBe(false);
  });

  test('platform reviewers are routed before community shells at login and on the root redirect', () => {
    for (const file of ['src/app/index.tsx', 'src/app/(auth)/login.tsx']) {
      const src = read(file);
      const platformAt = src.indexOf("router.replace('/(platform)'");
      const cmAt = src.indexOf("router.replace('/(cm)')");
      expect(platformAt, file).toBeGreaterThan(-1);
      expect(platformAt, file).toBeLessThan(cmAt);
    }
  });

  test('the (platform) shell is registered and gated on the platform_reviewer role', () => {
    expect(read('src/app/_layout.tsx')).toContain('name="(platform)"');
    const layout = read('src/app/(platform)/_layout.tsx');
    expect(layout).toContain('isPlatformReviewerRoutable');
    expect(layout).toContain("from('user_roles')");
    expect(layout).toMatch(/<Redirect href="\/" \/>/);
  });
});

test.describe('community creation goes through approval', () => {
  test('Portfolio never inserts into hoas or memberships; it opens the application flow', () => {
    const src = read('src/app/(cm)/index.tsx');
    expect(src).not.toMatch(/from\('hoas'\)\s*\.insert/);
    expect(src).not.toContain("from('hoa_memberships').insert");
    expect(src).toContain("/hoa-application?new=1");
  });

  test('no native screen calls create_community or inserts hoas directly', () => {
    for (const file of ['src/app/(cm)/index.tsx', 'src/app/hoa-application.tsx', 'src/app/(platform)/index.tsx', 'src/app/(platform)/application/[id].tsx']) {
      const src = read(file);
      expect(src, file).not.toContain("rpc('create_community'");
      expect(src, file).not.toMatch(/from\('hoas'\)\s*\.insert/);
    }
  });

  test('approval uses the existing RPCs, not direct table writes', () => {
    const src = read('src/app/(platform)/application/[id].tsx');
    expect(src).toContain("rpc('approve_hoa_application'");
    expect(src).toContain("rpc('update_hoa_application_status'");
    expect(src).not.toMatch(/from\('hoa_applications'\)\s*\.update/);
  });

  test('resubmitting a returned application updates the same row to pending (no duplicate insert)', () => {
    const src = read('src/app/hoa-application.tsx');
    expect(src).toMatch(/\.update\(\{ \.\.\.fields, status: 'pending' \}\)/);
    expect(src).toContain("['needs_more_info', 'rejected']");
  });

  test('role labels', () => {
    expect(ROLE_LABEL.board_member).toBe('Board member');
    expect(roleText({ claimed_role: 'other', claimed_role_other: 'Treasurer' })).toBe('Treasurer');
    expect(roleText({ claimed_role: 'property_manager', claimed_role_other: null })).toBe('Property manager');
  });
});

test.describe('community messaging wiring', () => {
  test('admin Messages tab is visible with an unread badge (no longer hidden)', () => {
    const layout = read('src/app/(cm)/_layout.tsx');
    const block = layout.slice(layout.indexOf('name="messages"'));
    expect(block).not.toMatch(/href:\s*null/);
    expect(layout).toContain('tabBarBadge');
    expect(layout).toContain('useUnreadMessages');
  });

  test('the root /messages route switches by product mode and keeps the tennis screen', () => {
    const src = read('src/app/messages.tsx');
    expect(src).toContain('isCommunityMode ? <CommunityMessagesRoute /> : <TennisMessagesScreen />');
    expect(src).toContain('function TennisMessagesScreen()');
  });

  test('residents have an entry point with an unread badge', () => {
    const me = read('src/app/(resident)/me.tsx');
    expect(me).toContain("router.push('/messages' as any)");
    expect(me).toContain('useUnreadMessages');
  });

  test('messaging subscribes to realtime, marks read as the recipient, and never edits or deletes messages', () => {
    const src = read('src/components/messaging/CommunityMessages.tsx');
    expect(src).toContain("table: 'messages'");
    expect(src).toContain("event: 'INSERT'");
    expect(src).toContain("event: 'UPDATE'");
    expect(src).toContain(".update({ read_at:");
    expect(src).not.toMatch(/\.delete\(\)/);
    expect(src).not.toMatch(/update\(\{\s*content/);
  });

  test('community messaging never invokes the email edge functions', () => {
    for (const file of ['src/components/messaging/CommunityMessages.tsx', 'src/hooks/useUnreadMessages.ts']) {
      const src = read(file);
      expect(src, file).not.toContain('functions.invoke');
      expect(src, file).not.toContain('send-message-notification');
    }
  });

  test('messaging UI uses the light admin palette and vector icons only', () => {
    const src = read('src/components/messaging/CommunityMessages.tsx');
    expect(src).toContain("from '@/constants/adminTheme'");
    expect(src).toContain("from 'lucide-react-native'");
    expect(src).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });
});
