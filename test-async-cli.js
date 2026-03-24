const { chromium } = require('playwright');
const path = require('path');
const { spawn } = require('child_process');

(async () => {
  const userDataDir = path.join(__dirname, 'test-user-data');
  console.log("Starting browser with persistent context...");
  
  const context = await chromium.launchPersistentContext(userDataDir, { 
      headless: true,
      viewport: { width: 1280, height: 800 }
  });
  
  const page = context.pages()[0];

  console.log("Navigating to WebApp...");
  await page.goto('http://172.20.10.2:8083');
  await page.waitForTimeout(2000);

  const createAccountBtn = page.getByText(/创建账户|Create account/i).first();
  const isNotLoggedIn = await createAccountBtn.isVisible().catch(() => false);

  if (isNotLoggedIn) {
      console.log("Not logged in. Creating account...");
      await createAccountBtn.click();
      await page.waitForTimeout(3000);
      
      console.log("Starting CLI auth login asynchronously...");
      
      // Use spawn instead of execSync to avoid blocking!
      const cliProcess = spawn('yarn', [
        'workspace', 'happy-coder', 'cli', 'auth', 'login', '--force'
      ], {
        env: {
            ...process.env,
            AUTO_SELECT_WEB: 'true',
            ENABLE_PLAINTEXT_MODE: 'true',
            HAPPY_SERVER_URL: 'http://172.20.10.2:3005',
            HAPPY_WEBAPP_URL: 'http://172.20.10.2:8083'
        }
      });

      let authLink = "";
      
      // Wait for the auth link from stdout
      await new Promise((resolve, reject) => {
          cliProcess.stdout.on('data', (data) => {
              const output = data.toString();
              const match = output.match(/(http:\/\/172\.20\.10\.2:8083\/terminal\/connect#key=[\w-]+)/);
              if (match && !authLink) {
                  authLink = match[1];
                  resolve();
              }
          });
          
          cliProcess.stderr.on('data', (data) => {
              console.log(`[CLI ERROR] ${data}`);
          });
          
          setTimeout(() => {
              if (!authLink) reject(new Error("Timeout waiting for auth link from CLI"));
          }, 15000);
      });

      console.log("Found Auth Link:", authLink);

      console.log(`Navigating to auth link: ${authLink}`);
      await page.goto(authLink);
      
      console.log("Waiting for 'Accept Connection' button...");
      const acceptBtn = page.getByText(/接受连接|Accept Connection/i).first();
      await acceptBtn.waitFor({ timeout: 10000 });
      await acceptBtn.click();
      await page.waitForTimeout(3000);
      
      console.log("Going back to home...");
      await page.goto('http://172.20.10.2:8083');
      await page.waitForTimeout(3000);
  } else {
      console.log("Already logged in (state persisted).");
  }

  console.log("Looking for machine to start session...");
  const machineLink = page.getByText(/MacBook/i).first();
  if (await machineLink.isVisible()) {
      console.log("Found machine, clicking...");
      await machineLink.click();
      await page.waitForTimeout(2000);
      
      const launchBtn = page.getByText(/Launch New Session/i).first();
      if (await launchBtn.isVisible()) {
          console.log("Clicking launch new session...");
          await launchBtn.click();
          await page.waitForTimeout(3000);
      }
  }

  console.log("Looking for chat input area...");
  const inputLocator = page.locator('textarea').first();
  
  if (await inputLocator.isVisible()) {
     console.log("Found input box, typing message...");
     const testMessage = "Hello Daemon! This is an automated test.";
     await inputLocator.fill(testMessage);
     await inputLocator.press('Enter');
     console.log(`Sent message: "${testMessage}"`);
     
     console.log("Waiting 5 seconds for response...");
     await page.waitForTimeout(5000);
     
     const bodyText = await page.locator('body').innerText();
     console.log("--- Current Page Text Snippet ---");
     console.log(bodyText.substring(0, 500) + "...");
     console.log("---------------------------------");
  } else {
     console.log("Could not find input box. Dumping page HTML to debug...");
  }

  console.log("Test finished.");
  await context.close();
  process.exit(0);
})();
