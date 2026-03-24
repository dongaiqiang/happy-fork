const { chromium } = require('playwright');
const { execSync } = require('child_process');

(async () => {
  // 1. 获取一个终端 Auth Link
  console.log("Generating auth link from CLI (with --force)...");
  let authLink = "";
  try {
    const output = execSync('AUTO_SELECT_WEB=true ENABLE_PLAINTEXT_MODE=true HAPPY_SERVER_URL=http://172.20.10.2:3005 HAPPY_WEBAPP_URL=http://172.20.10.2:8083 yarn workspace happy-coder cli auth login --force', { encoding: 'utf-8' });
    const match = output.match(/(http:\/\/172\.20\.10\.2:8083\/terminal\/connect#key=[\w-]+)/);
    if (match) {
      authLink = match[1];
      console.log("Found Auth Link:", authLink);
    } else {
      console.error("Could not find auth link in output:", output);
      process.exit(1);
    }
  } catch (e) {
    console.error("Failed to generate auth link:", e.stdout || e.message);
    process.exit(1);
  }

  // 2. 启动浏览器
  console.log("Starting browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // 3. 创建账号
  console.log("Navigating to WebApp...");
  await page.goto('http://172.20.10.2:8083');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  console.log("Waiting for 'Create account' button...");
  const createAccountBtn = page.getByText(/创建账户|Create account/i);
  await createAccountBtn.first().waitFor({ timeout: 10000 });
  
  console.log("Clicking Create account...");
  await createAccountBtn.first().click();
  await page.waitForTimeout(3000); // Wait for account creation
  
  // 4. 同意连接
  console.log(`Navigating to auth link: ${authLink}`);
  await page.goto(authLink);
  
  console.log("Waiting for 'Accept Connection' button...");
  const acceptBtn = page.getByText(/接受连接|Accept Connection/i);
  await acceptBtn.first().waitFor({ timeout: 10000 });
  
  console.log("Clicking Accept Connection...");
  await acceptBtn.first().click();
  
  // 等待同意连接处理完成
  await page.waitForTimeout(3000);
  
  // 5. 在网页端尝试发送一条消息 (模拟发送信息)
  console.log("Navigating back to main chat UI...");
  await page.goto('http://172.20.10.2:8083');
  await page.waitForTimeout(3000); // Wait for sync to load sessions
  
  console.log("Test finished successfully.");
  await browser.close();
  process.exit(0);
})();
