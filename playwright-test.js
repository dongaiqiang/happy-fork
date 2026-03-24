const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("Navigating to WebApp...");
  await page.goto('http://172.20.10.2:8083');
  
  // Clear local storage to ensure fresh state
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  console.log("Waiting for 'Create account' button...");
  // Find button by role/text
  const createAccountBtn = page.getByText(/创建账户|Create account/i);
  await createAccountBtn.first().waitFor({ timeout: 10000 });
  
  console.log("Clicking Create account...");
  await createAccountBtn.first().click();
  
  // Wait a moment for account creation to finish
  await page.waitForTimeout(3000);
  
  console.log("Navigating to auth link: http://172.20.10.2:8083/terminal/connect#key=Wba4aYj_sAuub1Fl0uEc4cRJFVx2VTdx8fzCx514AUA");
  await page.goto('http://172.20.10.2:8083/terminal/connect#key=Wba4aYj_sAuub1Fl0uEc4cRJFVx2VTdx8fzCx514AUA');
  
  console.log("Waiting for 'Accept Connection' button...");
  const acceptBtn = page.getByText(/接受连接|Accept Connection/i);
  await acceptBtn.first().waitFor({ timeout: 10000 });
  
  console.log("Clicking Accept Connection...");
  await acceptBtn.first().click();
  
  // Wait to see if any errors pop up or if it succeeds
  await page.waitForTimeout(3000);
  
  console.log("Test finished.");
  await browser.close();
})();
