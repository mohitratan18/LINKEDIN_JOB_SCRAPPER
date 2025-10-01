require('dotenv').config();
const { chromium } = require('playwright');
const logger = require('./helpers/logger/logger');
const config = require('../config.json');
const fs = require('fs');

async function autoScrollUntilEnd(page) {
  return await page.evaluate(async () => {
    let scrollable = document.querySelector('.scaffold-layout__list-container');
    if (!scrollable) {
      const sentinel = document.querySelector('div[data-results-list-top-scroll-sentinel]');
      if (sentinel) scrollable = sentinel.parentElement;
    }
    if (!scrollable) return { error: 'Could not find scrollable element' };

    let lastHeight = 0;
    let sameCount = 0;
    let scrollAttempts = 0;
    const maxAttempts = 50;

    while (sameCount < 3 && scrollAttempts < maxAttempts) {
            // Get current scroll position and height
            const scrollTop = scrollable.scrollTop;
            const scrollHeight = scrollable.scrollHeight;
            
            // Scroll down
            scrollable.scrollTop = scrollTop + 1000;
            
            // Wait for content to load
      await new Promise(r => setTimeout(r, 1500));

      const newHeight = scrollable.scrollHeight;
            
            console.log(`Scroll attempt ${scrollAttempts + 1}: height ${newHeight}, lastHeight ${lastHeight}`);
            
            if (newHeight === lastHeight) {
                sameCount++;
            } else {
        sameCount = 0;
        lastHeight = newHeight;
      }
            
      scrollAttempts++;
    }
        
        return { 
            success: true, 
            attempts: scrollAttempts 
        };
  }).then(result => {
        if (result.error) {
            logger.error(result.error);
        } else {
            logger.info(`Scrolling complete after ${result.attempts} attempts`);
        }
  });
}


const main = async () => {
    try {
      const storageFile = 'linkedin-auth.json';
      const Email = process.env.LINKEDIN_MAIL;
      const Password = process.env.LINKEDIN_PASSWORD;
  
      if (!Email || !Password) {
        logger.error('Email or Password not provided in .env file');
        throw new Error('Email or Password not provided in .env file');
      }
  
      logger.info('Starting LinkedIn job scraping process');

    // ✅ Launch browser once
      const browser = await chromium.launch({ headless: false });
      let context;
  
    // ✅ Check if we already have a session
      if (fs.existsSync(storageFile)) {
      logger.info('✅ Using saved LinkedIn session...');
        context = await browser.newContext({ storageState: storageFile });
      } else {
      logger.info('No saved session found. Logging in...');
        context = await browser.newContext();
        const page = await context.newPage();
  
        await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });
        await page.fill('#username', Email);
        await page.fill('#password', Password);
        await page.click('button[type="submit"]');
  
      logger.info('Login submitted, waiting for feed page...');
        await page.waitForURL('https://www.linkedin.com/feed/**', { timeout: 30000 });
      logger.info('✅ Login successful, saving session...');

        await context.storageState({ path: storageFile });
      logger.info('🔐 Session saved to linkedin-auth.json');
      }
  
    // ✅ Create page AFTER context
      const page = await context.newPage();
    if(!page.url().includes('feed')){
        await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });
      }
  
    logger.info('✅ Logged in and on feed page');

    // Navigate to jobs page
      const base = 'https://www.linkedin.com/jobs/search/';
      const params = new URLSearchParams();
      if (config.keywords) params.set('keywords', config.keywords);
      if (config.location) params.set('location', config.location);

      // 1 for internship , 2 for Entery Level add it in you config.json 

      if (config.experience) params.set('f_E', String(config.experience));
      const searchUrl = `${base}?${params.toString()}`;  

      await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
      logger.info('✅ Navigated to jobs search page');
  
      const jobs = [];
      let currentPage = 1;
  
      while (jobs.length < 150) {
        logger.info(`📄 Scraping page ${currentPage}...`);
        await autoScrollUntilEnd(page);
  
        const jobLinks = await page.$$('a.job-card-container__link');
        logger.info(`Found ${jobLinks.length} jobs on page ${currentPage}`);
  
        for (const link of jobLinks) {
          if (jobs.length >= 150) break; // stop when 150 jobs collected
          try {
            await link.click();
            const titleSelector = 'div.job-details-jobs-unified-top-card__job-title h1 a';
            await page.waitForSelector(titleSelector, { timeout: 20000 });
            const title = await page.textContent(titleSelector);
  
            const relativeHref = await page.getAttribute(titleSelector, 'href');
            const JobLink = `https://www.linkedin.com${relativeHref}`;
            logger.info(`Processing job: ${title}`);
  
            const companyNameSelector = 'div.job-details-jobs-unified-top-card__company-name a';
            await page.waitForSelector(companyNameSelector, { timeout: 20000 });
            const company = await page.textContent(companyNameSelector);
                logger.info(`Company: ${company}`);
  
            const locationSelector = 'div.job-details-jobs-unified-top-card__tertiary-description-container span span';
            await page.waitForSelector(locationSelector, { timeout: 20000 });
            const location = await page.textContent(locationSelector);
  
            const descriptionSelector = '#job-details';
            await page.waitForSelector(descriptionSelector, { timeout: 20000 });
            const description = await page.$eval(descriptionSelector, el => el.innerText.trim());
  
            jobs.push({ JobLink, title, company, location, description });
            logger.info(`✅ Saved job: ${title} at ${company}`);
            await page.waitForTimeout(1000);
          } catch (error) {
            logger.warn(`⚠️ Failed to process a job: ${error.message}`);
          }
        }
        // Save partial progress (just in case script crashes)
        fs.writeFileSync('jobs.json', JSON.stringify(jobs, null, 2));
  
        // If we already reached 150, break
        if (jobs.length >= 150) break;
  
        // Try to go to the next page
        currentPage++;
        const nextButton = await page.$(`button[aria-label="Page ${currentPage}"]`);
        if (nextButton) {
          logger.info(`➡️ Going to page ${currentPage}`);
          await nextButton.click();
          await page.waitForTimeout(3000); // wait for new jobs to load
        } else {
          logger.info('🚫 No more pages available');
          break;
        }
      }
  
      logger.info(`🎉 Finished! Collected ${jobs.length} jobs`);
      fs.writeFileSync('jobs.json', JSON.stringify(jobs, null, 2));
  
      await browser.close();
    } catch (error) {
      logger.error(`Script failed: ${error.message}`);
      throw error;
    }
  };

main().catch(error => {
    logger.error(`Application error: ${error.message}`);
    process.exit(1);
});
