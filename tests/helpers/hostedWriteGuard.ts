import type { Page } from '@playwright/test';

/**
 * Browser specs run against the hosted TENISX REAL project. They must never write to it: every non-GET REST/RPC/
 * Storage request is answered locally with a canned success. Auth (token refresh/sign-in/out) is passed through.
 */
export async function blockHostedWrites(page: Page): Promise<void> {
  await page.route(/\.supabase\.co\/(rest|storage|functions)\/v1\//, async (route) => {
    const req = route.request();
    const method = req.method();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return route.fallback();
    const url = req.url();
    const wantsObject = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object');
    if (/\/rest\/v1\/rpc\//.test(url)) return route.fulfill({ status: 200, contentType: 'application/json', body: 'true' });
    if (/\/storage\/v1\//.test(url)) return route.fulfill({ status: 200, contentType: 'application/json', body: '{"Key":"mock"}' });
    if (/\/functions\/v1\//.test(url)) return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    const body = wantsObject ? '{"id":"00000000-0000-0000-0000-000000000000","status":"confirmed"}' : '[]';
    return route.fulfill({ status: method === 'POST' ? 201 : 200, contentType: 'application/json', body });
  });
}
