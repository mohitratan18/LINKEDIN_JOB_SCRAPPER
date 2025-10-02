const fs = require('fs');
const logger = require('../../helpers/logger/logger');

const scrapData = async ({ limit, page,autoScrollUntilEnd }) => {
  const jobs = [];
  let currentPage = 1;

  while (jobs.length < limit) {
    logger.info(`📄 Scraping page ${currentPage}...`);
    await autoScrollUntilEnd(page);

    const jobLinks = await page.$$("a.job-card-container__link");
    logger.info(`Found ${jobLinks.length} jobs on page ${currentPage}`);

    for (const link of jobLinks) {
      if (jobs.length >= limit) break;
      try {
        await link.click();
        const titleSelector = "div.job-details-jobs-unified-top-card__job-title h1 a";
        await page.waitForSelector(titleSelector, { timeout: 20000 });
        const title = await page.textContent(titleSelector);

        const relativeHref = await page.getAttribute(titleSelector, "href");
        const JobLink = `https://www.linkedin.com${relativeHref}`;
        logger.info(`Processing job: ${title}`);

        const companyNameSelector = "div.job-details-jobs-unified-top-card__company-name a";
        await page.waitForSelector(companyNameSelector, { timeout: 20000 });
        const company = await page.textContent(companyNameSelector);
        logger.info(`Company: ${company}`);

        const locationSelector = "div.job-details-jobs-unified-top-card__tertiary-description-container span span";
        await page.waitForSelector(locationSelector, { timeout: 20000 });
        const location = await page.textContent(locationSelector);

        const descriptionSelector = "#job-details";
        await page.waitForSelector(descriptionSelector, { timeout: 20000 });
        const description = await page.$eval(descriptionSelector, (el) => el.innerText.trim());

        jobs.push({ JobLink, title, company, location, description });
        logger.info(`✅ Saved job: ${title} at ${company}`);
        await page.waitForTimeout(1000);
      } catch (error) {
        logger.warn(`⚠️ Failed to process a job: ${error.message}`);
      }
    }

    if (jobs.length >= limit) break;

    currentPage++;
    const nextButton = await page.$(`button[aria-label="Page ${currentPage}"]`);
    if (nextButton) {
      logger.info(`➡️ Going to page ${currentPage}`);
      await nextButton.click();
      await page.waitForTimeout(3000);
    } else {
      logger.info("🚫 No more pages available");
      break;
    }
  }

  return jobs;
};

module.exports = { scrapData };