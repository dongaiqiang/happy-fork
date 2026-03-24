const { chromium } = require('playwright');
const path = require('path');
const { execSync } = require('child_process');

(async () => {
  // 使用当前目录下的 test-user-data 文件夹来保存浏览器状态（类似 Chrome 的 User Data）
  const userDataDir = path.join(__dirname, 'test-user-data');
  
  console.log("Starting browser with persistent context...");
  // launchPersistentContext 会保留 localStorage、cookies 等状态
  const context = await chromium.launchPersistentContext(userDataDir, { 
      headless: true,
      viewport: { width: 1280, height: 800 }
  });
  
  // persistent context 会自带一个 page
  const page = context.pages()[0];

  console.log("Navigating to WebApp...");
  await page.goto('http://172.20.10.2:8083');
  await page.waitForTimeout(2000);

  // 检查是否已经登录（是否有创建账户按钮）
  const createAccountBtn = page.getByText(/创建账户|Create account/i).first();
  const isNotLoggedIn = await createAccountBtn.isVisible().catch(() => false);

  if (isNotLoggedIn) {
      console.log("Not logged in. Creating account...");
      await createAccountBtn.click();
      await page.waitForTimeout(3000);
      
      console.log("Generating auth link from CLI (with --force)...");
      let authLink = "";
      try {
        const output = execSync('AUTO_SELECT_WEB=true ENABLE_PLAINTEXT_MODE=true HAPPY_SERVER_URL=http://172.20.10.2:3005 HAPPY_WEBAPP_URL=http://172.20.10.2:8083 yarn workspace happy-coder cli auth login --force', { encoding: 'utf-8' });
        const match = output.match(/(http:\/\/172\.20\.10\.2:8083\/terminal\/connect#key=[\w-]+)/);
        if (match) {
          authLink = match[1];
          console.log("Found Auth Link:", authLink);
        } else {
          console.error("Could not find auth link.");
          process.exit(1);
        }
      } catch (e) {
        console.error("CLI error:", e.message);
        process.exit(1);
      }

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

  // 现在应该在主界面了，寻找可以点击的机器或者输入框
  console.log("Looking for machine to start session...");
  // 在左侧边栏或者主界面点击名为 MacBook 的机器
  const machineLink = page.getByText(/MacBook/i).first();
  if (await machineLink.isVisible()) {
      console.log("Found machine, clicking...");
      await machineLink.click();
      await page.waitForTimeout(2000);
      
      // 点击新建对话按钮（如果有的话）
      const launchBtn = page.getByText(/Launch New Session/i).first();
      if (await launchBtn.isVisible()) {
          console.log("Clicking launch new session...");
          await launchBtn.click();
          await page.waitForTimeout(3000);
      }
  } else {
      console.log("Machine link not found directly, assuming we are already in a chat or it's named differently.");
  }

  // 寻找输入框
  console.log("Looking for chat input area...");
  // Happy Coder 的输入框通常是一个 textarea
  const inputLocator = page.locator('textarea').first();
  
  if (await inputLocator.isVisible()) {
     console.log("Found input box, typing message...");
     const testMessage = "Hello Daemon! This is an automated test.";
     await inputLocator.fill(testMessage);
     await inputLocator.press('Enter');
     console.log(`Sent message: "${testMessage}"`);
     
     console.log("Waiting 5 seconds for response...");
     await page.waitForTimeout(5000);
     
     // 抓取页面文本看看有没有回复
     const bodyText = await page.locator('body').innerText();
     console.log("--- Current Page Text Snippet ---");
     console.log(bodyText.substring(0, 500) + "...");
     console.log("---------------------------------");
  } else {
     console.log("Could not find input box. Dumping page HTML to debug...");
     const html = await page.content();
     console.log(html.substring(0, 1000) + "...");
  }

  console.log("Test finished.");
  await context.close();
})();
