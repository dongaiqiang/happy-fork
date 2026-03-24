const { chromium } = require('playwright');

(async () => {
  console.log("Starting browser to test message sending...");
  const browser = await chromium.launch({ headless: true });
  // Using an incognito context but we must reuse the storage to stay logged in
  // Wait, the easiest way to test this without losing login state is to log in again OR use the existing state.
  // We'll just login quickly again since it's fast, then click a machine, then type.
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("Navigating to WebApp...");
  await page.goto('http://172.20.10.2:8083');
  
  // See if we are logged in, if not, create account
  const createAccountBtn = page.getByText(/创建账户|Create account/i).first();
  if (await createAccountBtn.isVisible()) {
      console.log("Not logged in. Re-creating account...");
      await createAccountBtn.click();
      await page.waitForTimeout(3000);
      
      // We need to link the device again if we created a new account
      console.log("We need a new auth link since we created a new account in this context...");
      const { execSync } = require('child_process');
      const output = execSync('AUTO_SELECT_WEB=true ENABLE_PLAINTEXT_MODE=true HAPPY_SERVER_URL=http://172.20.10.2:3005 HAPPY_WEBAPP_URL=http://172.20.10.2:8083 yarn workspace happy-coder cli auth login --force', { encoding: 'utf-8' });
      const match = output.match(/(http:\/\/172\.20\.10\.2:8083\/terminal\/connect#key=[\w-]+)/);
      if (match) {
          const authLink = match[1];
          console.log(`Navigating to auth link: ${authLink}`);
          await page.goto(authLink);
          const acceptBtn = page.getByText(/接受连接|Accept Connection/i).first();
          await acceptBtn.waitFor({ timeout: 10000 });
          await acceptBtn.click();
          await page.waitForTimeout(3000);
          await page.goto('http://172.20.10.2:8083');
          await page.waitForTimeout(3000);
      }
  }

  console.log("Looking for machines to start a session...");
  // In the UI, usually we click on a machine name like "MacBook-Pro.local" or "Start new session"
  const machineLink = page.getByText(/MacBook|local/i).first();
  
  if (await machineLink.isVisible()) {
      console.log("Clicking on machine to start session...");
      await machineLink.click();
      await page.waitForTimeout(3000);
      
      // Look for the "Launch New Session in Directory" or similar button
      const launchBtn = page.getByText(/Launch|Launch New Session/i).first();
      if (await launchBtn.isVisible()) {
          console.log("Clicking launch session button...");
          await launchBtn.click();
          await page.waitForTimeout(3000);
      }
  }

  // Now look for the chat input
  console.log("Looking for chat input area...");
  const inputLocator = page.locator('textarea').first();
  
  if (await inputLocator.isVisible()) {
     console.log("Found input box, typing message...");
     const testMessage = "Hello from Playwright! Please respond with 'Test successful'";
     await inputLocator.fill(testMessage);
     await inputLocator.press('Enter');
     console.log(`Sent message: "${testMessage}"`);
     
     console.log("Waiting for response...");
     // Wait for any new text to appear in the chat that isn't our own message
     // We just wait 10 seconds to see what gets rendered
     await page.waitForTimeout(10000);
     
     // Dump the text content of the page to see if there's a response
     const bodyText = await page.locator('body').innerText();
     console.log("--- Current Page Text ---");
     console.log(bodyText.substring(0, 1000) + "...");
     console.log("-------------------------");
     
  } else {
     console.log("Could not find input box. Page text:");
     const bodyText = await page.locator('body').innerText();
     console.log(bodyText);
  }

  console.log("Test finished.");
  await browser.close();
  process.exit(0);
})();
