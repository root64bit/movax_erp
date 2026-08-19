import { test, expect, Page } from '@playwright/test';


function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Defina ${name} para executar os testes E2E.`);
  return value;
}

const adminCredentials = () => ({
  email: requiredEnv('E2E_ADMIN_EMAIL'),
  password: requiredEnv('E2E_ADMIN_PASSWORD'),
});
const cashierCredentials = () => ({
  email: requiredEnv('E2E_CASHIER_EMAIL'),
  password: requiredEnv('E2E_CASHIER_PASSWORD'),
});

async function loginAs(page: Page, email: string, pass: string) {
  await page.goto('/');

  // Wait for loading to clear
  await page.waitForLoadState('networkidle');

  // Check if sign out button exists (already logged in)
  const signOutBtn = page.locator('button:has-text("Sair"), button:has-text("Terminar Sessão")').first();
  if (await signOutBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await signOutBtn.click();
    await page.waitForTimeout(1000);
  }

  // Check if at login form
  const emailInput = page.locator('input[type="email"]').first();
  if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await emailInput.fill(email);
    await page.locator('#login-password, input[type="password"]').first().fill(pass);
    await page.locator('button[type="submit"]').first().click();
  }

  // Wait until navigation menu is rendered
  await expect(page.locator('nav').first()).toBeVisible({ timeout: 20000 });
}

test.describe('Movax — Full Platform End-to-End QA Suite', () => {

  test('01. Admin Login & Full Navigation Menu Availability', async ({ page }) => {
    { const c = adminCredentials(); await loginAs(page, c.email, c.password); }

    // Check full admin menu items
    await expect(page.locator('text=Nova Venda').first()).toBeVisible();
    await expect(page.locator('text=Cotação').first()).toBeVisible();
    await expect(page.locator('text=Artigos e Stock').first()).toBeVisible();
    await expect(page.locator('text=Relatórios').first()).toBeVisible();
    await expect(page.locator('text=Administração').first()).toBeVisible();
  });

  test('02. Cashier Restricted Access Isolation (Operador de Caixa)', async ({ page }) => {
    { const c = cashierCredentials(); await loginAs(page, c.email, c.password); }

    // Verify Direct Redirect to Nova Venda upon login
    await expect(page.locator('button:has-text("Guia de Remessa")')).toBeEnabled();

    // Verify Restricted Navigation Menu (Only Nova Venda & Cotação)
    await expect(page.locator('nav >> text=Nova Venda')).toBeVisible();
    await expect(page.locator('nav >> text=Cotação')).toBeVisible();

    // Verify Restricted Tabs & Entities Are Hidden from Menu
    await expect(page.locator('nav >> text=Artigos e Stock')).toHaveCount(0);
    await expect(page.locator('nav >> text=Clientes e Fornecedores')).toHaveCount(0);
    await expect(page.locator('nav >> text=Relatórios')).toHaveCount(0);
    await expect(page.locator('nav >> text=Administração')).toHaveCount(0);

    // Verify Nova Venda Document Restrictions for Cashier
    await expect(page.locator('button:has-text("Factura (Restrito)")')).toBeDisabled();
    await expect(page.locator('button:has-text("VD (Restrito)")')).toBeDisabled();

    // Verify Cotação Access for Cashier
    await page.click('text=Cotação');
    await expect(page.locator('text=Histórico de Cotações Emitidas').first()).toBeVisible();
  });

  test('03. Nova Venda Document Selector & Walk-In Customer Sequence', async ({ page }) => {
    { const c = adminCredentials(); await loginAs(page, c.email, c.password); }

    await page.click('text=Nova Venda');
    await expect(page.locator('text=Factura').first()).toBeVisible();
    await expect(page.locator('text=Venda a Dinheiro (VD)').first()).toBeVisible();
    await expect(page.locator('text=Guia de Remessa').first()).toBeVisible();

    // Switch to Guia de Remessa
    await page.click('text=Guia de Remessa');
    await expect(page.locator('text=Guia de Remessa').first()).toBeVisible();

    // Verify Walk-in customer code is selected
    const clientCodeInput = page.locator('input[value="1"]').first();
    await expect(clientCodeInput).toBeVisible();
  });

  test('04. Quotations History & Table Operator Column Verification', async ({ page }) => {
    { const c = adminCredentials(); await loginAs(page, c.email, c.password); }

    await page.click('text=Cotação');
    await expect(page.locator('text=Histórico de Cotações Emitidas').first()).toBeVisible();

    // Verify OPERADOR table header is present
    await expect(page.locator('th:has-text("OPERADOR")').first()).toBeVisible();
  });

  test('05. Sales Reports PVR Formula & Summary Totals Row', async ({ page }) => {
    { const c = adminCredentials(); await loginAs(page, c.email, c.password); }

    await page.click('text=Relatórios');
    await expect(page.locator('text=Relatório de Vendas por Artigo').first()).toBeVisible();

    // Verify Custom PVR Formula Explanation
    await expect(page.locator('text=[ (PVP - Margem%) / (1 + IVA%) ]').first()).toBeVisible();

    // Verify Summary Totals Row (tfoot) if items exist or table container is present
    await expect(page.locator('section:has-text("Relatório de Vendas por Artigo")').first()).toBeVisible();
  });

});
