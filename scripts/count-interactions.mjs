// NFR-USA-01 measurement (SRS): "Declaring an object takes 5 interactions or fewer from the home page
// (clicks or taps, text entry excluded). Measurement: scripted count." Test case TC-NFR-USA-01.
//
// The script drives the real application in a browser, from the home page to a submitted declaration,
// and counts every click, selection and file choice. Typing text is done but not counted.
//
// Usage (the server and the client must run, and the account must be verified):
//   npm install --no-save playwright && npx playwright install chromium
//   node scripts/count-interactions.mjs student@your-school.edu Password123
// Optional: CLIENT_URL (default http://localhost:5173).
import { chromium } from 'playwright';

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error('Usage: node scripts/count-interactions.mjs <email> <password>');
  process.exit(2);
}
const baseUrl = process.env.CLIENT_URL ?? 'http://localhost:5173';
const LIMIT = 5;
// A tiny valid JPEG, written to a temporary file for the photo field.
const JPEG = Buffer.from(
  'ffd8ffe000104a46494600010100000100010000ffdb0043000302020302020303030304030304050805050404050a070706080c0a0c0c0b0a0b0b0d0e12100d0e110e0b0b1016101113141515150c0f171816141812141514ffc0000b080001000101011100ffc4001f0000010501010101010100000000000000000102030405060708090a0bffc400b5100002010303020403050504040000017d01020300041105122131410613516107227114328191a1082342b1c11552d1f02433627282090a161718191a25262728292a3435363738393a434445464748494a535455565758595a636465666768696a737475767778797a838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae1e2e3e4e5e6e7e8e9eaf1f2f3f4f5f6f7f8f9faffda0008010100003f00fbd3ffd9',
  'hex',
);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });

// Signing in is a precondition of the measure, not a part of it.
await page.goto(`${baseUrl}/login`);
await page.fill('input[type=email]', email);
await page.fill('input[type=password]', password);
await page.click('button.primary');
await page.waitForURL(`${baseUrl}/`);

async function selectFirstOption(label) {
  const select = page.locator('label', { hasText: label }).locator('select');
  const value = await select.locator('option:not([value=""])').first().getAttribute('value');
  await select.selectOption(value);
}

async function run(name, build) {
  await page.goto(`${baseUrl}/`);
  const steps = [];
  const count = async (description, action) => {
    steps.push(description);
    await action();
  };
  await build(count);
  await page.waitForURL(/\/announcements\/\d+$/);
  console.log(`\n${name}: ${steps.length} interactions (limit ${LIMIT}) -> ${steps.length <= LIMIT ? 'OK' : 'NOT MET'}`);
  steps.forEach((step, index) => console.log(`  ${index + 1}. ${step}`));
  return steps.length;
}

const found = await run('Found object', async (count) => {
  await count('click "I found an object" on the home page', () => page.click('a:has-text("I found an object")'));
  await page.fill('input[maxlength="100"]', 'Interaction count test (found)'); // text entry, not counted
  await page.fill('textarea', 'Found during the NFR-USA-01 measurement.');
  await count('choose the category', () => selectFirstOption('Category'));
  await count('choose the precise object', () => selectFirstOption('Precise object'));
  await count('choose the place', () => selectFirstOption('Place'));
  // "I keep it" is preselected: it is not an interaction, but check that it is really selected.
  if (!(await page.locator('label:has-text("I keep it") input').isChecked())) {
    throw new Error('"I keep it" should be preselected');
  }
  await page.fill('input[placeholder^="A detail only"]', 'Sticker on the back');
  await count('choose one photo', () =>
    page.setInputFiles('input[type=file]', { name: 'photo.jpg', mimeType: 'image/jpeg', buffer: JPEG }),
  );
  await count('click the submit button', () => page.click('button.primary'));
});

const lost = await run('Lost object', async (count) => {
  await count('click "I lost an object" on the home page', () => page.click('a:has-text("I lost an object")'));
  await page.fill('input[maxlength="100"]', 'Interaction count test (lost)');
  await page.fill('textarea', 'Lost during the NFR-USA-01 measurement.');
  await count('choose the category', () => selectFirstOption('Category'));
  await count('choose the precise object', () => selectFirstOption('Precise object'));
  await count('choose the place', () => selectFirstOption('Place'));
  await count('click the submit button', () => page.click('button.primary'));
});

await browser.close();
console.log(`\nSummary: found ${found}, lost ${lost}, limit ${LIMIT}.`);
process.exit(found <= LIMIT && lost <= LIMIT ? 0 : 1);
