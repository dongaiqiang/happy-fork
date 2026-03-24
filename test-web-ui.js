const { chromium } = require('playwright');

(async () => {
  console.log("Starting browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // 1. 创建账号
  console.log("Navigating to WebApp...");
  await page.goto('http://172.20.10.2:8083');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  console.log("Waiting for 'Create account' button...");
  const createAccountBtn = page.getByText(/创建账户|Create account/i);
  await createAccountBtn.first().waitFor({ timeout: 10000 });
  
  console.log("Clicking Create account...");
  await createAccountBtn.first().click();
  await page.waitForTimeout(3000); 
  
  // 2. 同意连接
  const authLink = 'http://172.20.10.2:8083/terminal/connect#key=ksJLsoILDEwcoU6g6_LOWwMaaI1vw7bcAfK1AdDCAnc';
  console.log(`Navigating to auth link: ${authLink}`);
  await page.goto(authLink);
  
  console.log("Waiting for 'Accept Connection' button...");
  const acceptBtn = page.getByText(/接受连接|Accept Connection/i);
  await acceptBtn.first().waitFor({ timeout: 10000 });
  
  console.log("Clicking Accept Connection...");
  await acceptBtn.first().click();
  
  await page.waitForTimeout(3000);
  
  // 3. 在网页端尝试发送一条消息
  console.log("Navigating back to main chat UI...");
  await page.goto('http://172.20.10.2:8083');
  await page.waitForTimeout(3000);
  
  console.log("Test finished successfully.");
  await browser.close();
  process.exit(0);
})();
