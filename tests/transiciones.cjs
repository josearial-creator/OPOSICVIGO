const {chromium} = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH === 'bundled' ? undefined : (process.env.CHROMIUM_PATH || '/usr/bin/chromium'),
    headless: true, args: ['--no-sandbox']
  });
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 844}, acceptDownloads: true});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://raw.githubusercontent.com/**', route => route.fulfill({json: []}));
    await page.goto('http://127.0.0.1:8086');
    await page.locator('#transition-stop').waitFor();
    assert.match(await page.locator('.transition-panel').innerText(), /13:45/);
    assert.equal(await page.locator('#transition-meal').isDisabled(), true);
    const before = await page.evaluate(() => localStorage.getItem('rumbo-evolucion-v1'));

    await page.locator('#transition-stop').click();
    assert.match(await page.locator('#transition-status').innerText(), /guardada/i);
    assert.equal(await page.locator('#transition-stop').isDisabled(), true);
    assert.equal(await page.locator('#transition-meal').isEnabled(), true);
    let state = await page.evaluate(() => JSON.parse(localStorage.getItem('rumbo-transiciones-v1')));
    assert.equal(state.version, 1);
    assert.equal(state.records.length, 1);
    assert.ok(Number.isFinite(Date.parse(state.records[0].stopAt)));
    assert.equal(state.records[0].mealAt, null);

    await page.locator('#transition-difficulty').selectOption('alta');
    await page.locator('#transition-meal').click();
    state = await page.evaluate(() => JSON.parse(localStorage.getItem('rumbo-transiciones-v1')));
    assert.equal(state.records[0].difficulty, 'alta');
    assert.ok(Number.isFinite(Date.parse(state.records[0].mealAt)));
    assert.ok(Date.parse(state.records[0].mealAt) >= Date.parse(state.records[0].stopAt));
    assert.equal(await page.evaluate(() => localStorage.getItem('rumbo-evolucion-v1')), before);

    const download = page.waitForEvent('download');
    await page.locator('#transition-export').click();
    assert.equal((await download).suggestedFilename(), 'rumbo-transiciones.json');
    await page.reload();
    assert.equal(await page.locator('#transition-stop').isDisabled(), true);
    assert.equal(await page.locator('#transition-meal').isDisabled(), true);
    assert.equal(await page.locator('#transition-difficulty').inputValue(), 'alta');
    assert.match(await page.locator('#transition-status').innerText(), /Comida iniciada/i);
    assert.deepEqual(errors, []);

    await page.evaluate(() => localStorage.setItem('rumbo-transiciones-v1', '{"version":999,"records":[]}'));
    await page.reload();
    assert.equal(await page.locator('#transition-stop').isDisabled(), true);
    assert.match(await page.locator('#transition-status').innerText(), /no se sobrescribirán/i);
    assert.equal(await page.evaluate(() => localStorage.getItem('rumbo-transiciones-v1')), '{"version":999,"records":[]}');
    console.log('PASS: parada y comida, guardado, recarga, exportación, aislamiento y copia incompatible.');
  } finally {
    await browser.close();
  }
})().catch(error => {console.error(error); process.exit(1);});
