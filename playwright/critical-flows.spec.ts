import { expect, test } from '@playwright/test';

test('SPA navigation and reactive activity filtering', async ({ page }) => {
  await page.goto('http://127.0.0.1:4000/');
  await expect(page.getByRole('heading', { name: 'Everything is running smoothly.' })).toBeVisible();

  await page.getByRole('link', { name: 'Activity' }).click();
  await expect(page).toHaveURL('http://127.0.0.1:4000/activity');
  await expect(page.getByTestId('activity-list').getByRole('listitem')).toHaveCount(4);

  await page.getByRole('button', { name: 'deployment' }).click();
  await expect(page.getByTestId('activity-list').getByRole('listitem')).toHaveCount(2);
  await expect(page.getByText('Production deployment completed')).toBeVisible();
  await expect(page.getByText('Workspace member invited')).toHaveCount(0);
});

test('SSR sends application HTML, hydrates it in place, and navigates on the client', async ({ page, request }) => {
  const response = await request.get('http://127.0.0.1:3001/activity');
  const html = await response.text();
  expect(response.ok()).toBe(true);
  expect(html).toContain('Recent activity');
  expect(html).toContain('Production deployment completed');

  await page.route('http://127.0.0.1:3001/', async (route) => {
    const documentResponse = await route.fetch();
    const body = await documentResponse.text();
    await route.fulfill({
      response: documentResponse,
      body: body.replace(
        '</body>',
        '<script>window.__northstarServerNode = document.querySelector("#app > *");</script></body>',
      ),
    });
  });
  await page.goto('http://127.0.0.1:3001/');
  await expect(page.getByRole('heading', { name: 'Everything is running smoothly.' })).toBeVisible();
  expect(await page.evaluate(() => {
    const state = window as Window & { __northstarServerNode?: Element };
    return state.__northstarServerNode === document.querySelector('#app > *');
  })).toBe(true);

  await page.getByRole('link', { name: 'Activity' }).click();
  await expect(page).toHaveURL('http://127.0.0.1:3001/activity');
  await page.getByRole('button', { name: 'policy' }).click();
  await expect(page.getByTestId('activity-list').getByRole('listitem')).toHaveCount(1);
});

test('authenticated SSR data, mutations, theme persistence, and Monaco policy save', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('http://127.0.0.1:3002/workspace');
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.getByRole('button', { name: 'Sign in as Demo Operator' }).click();
  await expect(page.getByRole('heading', { name: 'Operations dashboard' })).toBeVisible();

  let dashboardRequests = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/dashboard') dashboardRequests += 1;
  });
  await page.goto('http://127.0.0.1:3002/workspace');
  await expect(page.getByRole('heading', { name: 'Operations dashboard' })).toBeVisible();
  await expect(page.getByText('Loading dashboard…')).toHaveCount(0);
  expect(dashboardRequests).toBe(0);

  await page.getByRole('link', { name: 'Users' }).click();
  await page.getByRole('link', { name: 'View user' }).first().click();
  const editUser = page.getByRole('button', { name: 'Edit user' });
  await editUser.focus();
  await editUser.press('Enter');
  await expect(editUser).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('Display name').fill('Ada Byron');
  await page.getByRole('button', { name: 'Save user' }).click();
  await expect(page.getByRole('status')).toHaveText('User saved.');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('link', { name: 'Users' }).click();
  await expect(page.getByText('Ada Byron')).toBeVisible();

  const themeToggle = page.getByRole('button', { name: 'Toggle color theme' });
  await themeToggle.click();
  const storedTheme = await page.evaluate(() => localStorage.getItem('askr-examples-theme'));
  expect(storedTheme).toMatch(/^(light|dark)$/);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme-choice', storedTheme!);

  await page.getByRole('link', { name: 'Policies' }).click();
  await expect(page.getByRole('heading', { name: 'Support escalation' })).toBeVisible();
  await expect(page.getByLabel('Policy source')).toBeVisible();
  await page.getByRole('button', { name: 'Save policy' }).click();
  await expect(page.getByRole('status')).toHaveText('Policy saved.');
  expect(pageErrors).toEqual([]);
});
