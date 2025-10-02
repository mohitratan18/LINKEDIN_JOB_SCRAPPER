const fs = require('fs');

const login = async ({ browser, context, logger, data: { Email, Password }, storageFile }) => {
  try {
    // ✅ Check if we already have a session
    if (fs.existsSync(storageFile)) {
      logger.info("✅ Using saved LinkedIn session...");
      return await browser.newContext({ storageState: storageFile });
    } 

    logger.info("No saved session found. Logging in...");
    context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("https://www.linkedin.com/login", {
      waitUntil: "domcontentloaded",
    });
    await page.fill("#username", Email);
    await page.fill("#password", Password);
    await page.click('button[type="submit"]');

    logger.info("Login submitted, waiting for feed page...");
    await page.waitForURL("https://www.linkedin.com/feed/**", {
      timeout: 30000,
    });
    logger.info("✅ Login successful, saving session...");

    await context.storageState({ path: storageFile });
    logger.info("🔐 Session saved to linkedin-auth.json");

    return context;
  } catch (error) {
    throw new Error(`Error during login: ${error.message}`);
  }
};

module.exports = { login };
