require("dotenv").config();
const { chromium } = require("playwright");
const logger = require("../../helpers/logger/logger");
const config = require("../../configs/config.json");
const fs = require("fs");
const { login } = require("../../helpers/login_linkedin");
const { scrapData } = require("../../scrappers/job_scrapper");
const { autoScrollUntilEnd } = require("../../utils/scroll.utils");

const ScrapperModule = async () => {
  try {
    const storageFile = "linkedin-auth.json";
    const Email = process.env.LINKEDIN_MAIL;
    const Password = process.env.LINKEDIN_PASSWORD;

    if (!Email || !Password) {
      logger.error("Email or Password not provided in .env file");
      throw new Error("Email or Password not provided in .env file");
    }

    logger.info("Starting LinkedIn job scraping process");

    // ✅ Launch browser once
    const browser = await chromium.launch({ headless: false });
    let context;

    context = await login({
      browser,
      context,
      logger,
      data: { Email, Password },
      storageFile,
    });
    // ✅ Create page AFTER context
    const page = await context.newPage();
    if (!page.url().includes("feed")) {
      await page.goto("https://www.linkedin.com/feed/", {
        waitUntil: "domcontentloaded",
      });
    }
    logger.info("✅ Logged in and on feed page");

    // Navigate to jobs page
    const base = "https://www.linkedin.com/jobs/search/";
    const params = new URLSearchParams();
    if (config.keywords) params.set("keywords", config.keywords);
    if (config.location) params.set("location", config.location);
    if (config.experience) params.set("f_E", String(config.experience)); // 1 for internship , 2 for Entery Level add it in you config.json
    const searchUrl = `${base}?${params.toString()}`;
    await page.goto(searchUrl, { waitUntil: "domcontentloaded" });
    logger.info("✅ Navigated to jobs search page");
    const jobs = await scrapData({
      limit: config.limit || 150,
      page,
      logger,
      autoScrollUntilEnd,
    });

    logger.info(`🎉 Finished! Collected ${jobs.length} jobs`);
    fs.writeFileSync("jobs.json", JSON.stringify(jobs, null, 2));

    await browser.close();
    return {
      data: jobs,
      status: 200,
      success: true,
    };
  } catch (error) {
    logger.error(`Script failed: ${error.message}`);
    return {
      data: [],
      status: 500,
      success: false,
    };
  }
};

module.exports = { ScrapperModule };