import { test, expect, Page } from '@playwright/test';


function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Defina ${name} para executar os testes E2E.`);
  return value;
}

async function loginAsAdmin(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  // Check if already logged in (nav is visible)
  if (await page.locator('nav').first().isVisible({ timeout: 3000 }).catch(() => false)) {
    return;
  }

  const emailInput = page.locator('input[type="email"]').first();
  await emailInput.waitFor({ state: 'visible', timeout: 8000 });
  await emailInput.fill(requiredEnv('E2E_ADMIN_EMAIL'));

  const passInput = page.locator('#login-password').first();
  await passInput.fill(requiredEnv('E2E_ADMIN_PASSWORD'));

  await page.locator('button[type="submit"]:has-text("Entrar")').click();

  await expect(page.locator('nav').first()).toBeVisible({ timeout: 15000 });
}

test.describe('Movax — Latest Features E2E QA Suite', () => {

  test('01. Dark Mode Global Toggle & High Contrast Text', async ({ page }) => {
    await loginAsAdmin(page);

    // Locate theme toggle button
    const themeBtn = page.locator('button:has-text("Modo Escuro"), button:has-text("Modo Claro")').first();
    await expect(themeBtn).toBeVisible();

    // Click to switch to Dark Mode if not dark
    const isAlreadyDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    if (!isAlreadyDark) {
      await themeBtn.click();
    }

    // Verify dark class is applied to html and body
    const isDarkNow = await page.evaluate(() => 
      document.documentElement.classList.contains('dark') && document.body.classList.contains('dark')
    );
    expect(isDarkNow).toBe(true);

    // Verify localStorage persistence
    const savedTheme = await page.evaluate(() => localStorage.getItem('theme'));
    expect(savedTheme).toBe('dark');
  });

  test('02. Verify Removal of Ctrl+L / Último Documento Button', async ({ page }) => {
    await loginAsAdmin(page);

    await page.click('text=Nova Venda');
    await expect(page.locator('text=Factura').first()).toBeVisible();

    // Verify "Último Documento (Ctrl+L)" button does NOT exist
    const lastDocBtn = page.locator('button:has-text("Último Documento")');
    await expect(lastDocBtn).toHaveCount(0);
  });

  test('03. Reports Custo c/IVA Column Toggle Button', async ({ page }) => {
    await loginAsAdmin(page);

    await page.click('text=Relatórios');
    await expect(page.locator('text=Relatório de Vendas por Artigo').first()).toBeVisible();

    // Locate cost column toggle button
    const toggleBtn = page.locator('button:has-text("Coluna Custo")').first();
    await expect(toggleBtn).toBeVisible();

    // Click toggle button
    await toggleBtn.click();
    await page.waitForTimeout(500);

    // Click back
    await toggleBtn.click();
    await page.waitForTimeout(500);
  });

  test('04. Dynamic Bank Accounts in Administration', async ({ page }) => {
    await loginAsAdmin(page);

    await page.click('text=Administração');
    await expect(page.locator('text=Configurações de Cotações').first()).toBeVisible();

    // Verify Add Bank button exists
    const addBankBtn = page.locator('button:has-text("Adicionar Banco")').first();
    await expect(addBankBtn).toBeVisible();
  });

});
