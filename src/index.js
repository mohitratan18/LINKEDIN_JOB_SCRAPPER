require('dotenv').config();
const { chromium } = require('playwright');
const logger = require('./helpers/logger/logger');

async function autoScrollUntilEnd(page) {
    await page.evaluate(async () => {
        // Try multiple selectors to find the scrollable container
        let scrollable = document.querySelector('.scaffold-layout__list-container');
        
        if (!scrollable) {
            // Fallback: find the parent div that contains the sentinel and UL
            const sentinel = document.querySelector('div[data-results-list-top-scroll-sentinel]');
            if (sentinel) {
                scrollable = sentinel.parentElement;
            }
        }
        
        if (!scrollable) {
            logger.error('Could not find scrollable element');
            return;
        }

        logger.info('Found scrollable element:', scrollable.className);
        
        let lastHeight = 0;
        let sameCount = 0;
        let scrollAttempts = 0;
        const maxAttempts = 50; // Prevent infinite loops

        while (sameCount < 3 && scrollAttempts < maxAttempts) {
            // Get current scroll position and height
            const scrollTop = scrollable.scrollTop;
            const scrollHeight = scrollable.scrollHeight;
            
            // Scroll down
            scrollable.scrollTop = scrollTop + 1000;
            
            // Wait for content to load
            await new Promise(r => setTimeout(r, 1500));

            const newHeight = scrollable.scrollHeight;
            
            logger.info(`Scroll attempt ${scrollAttempts + 1}: height ${newHeight}, lastHeight ${lastHeight}`);
            
            if (newHeight === lastHeight) {
                sameCount++;
            } else {
                sameCount = 0;
                lastHeight = newHeight;
            }
            
            scrollAttempts++;
        }
        
        logger.info(`Scrolling complete after ${scrollAttempts} attempts`);
    });
}


const main = async () => {
    try {
        const browser = await chromium.launch({ headless: false });
        const page = await browser.newPage();
        const Email = process.env.LINKEDIN_MAIL;
        const Password = process.env.LINKEDIN_PASSWORD;

        if(!Email || !Password){
            logger.error('Email or Password not provided in .env file');
            throw new Error('Email or Password not provided in.env file');
        }

        logger.info('Starting LinkedIn job scraping process');
        logger.info('Navigating to LinkedIn login page');
        await page.goto('https://www.linkedin.com/login', { 
            waitUntil: 'networkidle',
        });

        if(page.url().includes('login')){
            logger.info('Login page loaded successfully');
            await page.getByRole('textbox', { name: 'Email or Phone' }).fill(Email);
            await page.getByRole('textbox', { name: 'Password' }).fill(Password);
            await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    
            logger.info('Login successful, waiting for navigation');
            // await page.waitForNavigation();
        }

        if(page.url().includes('start') || page.url().includes('feed')){
            logger.info('Signup page detected, skipping login');
        }   

        await page.getByRole('link', { name: 'Jobs' , exact:true }).click();
        await page.waitForNavigation();

        if (page.url().includes('jobs')) {
            logger.info('Successfully navigated to jobs page');
            await page.getByRole('link', { name: 'Show all Top job picks for you' }).click();
            await page.waitForNavigation();
        } else {
            logger.error('Failed to navigate to jobs page');
            await browser.close();
            throw new Error('Not navigated to jobs page');
        }

        logger.info('Starting job listing scroll');

        await autoScrollUntilEnd(page);


        const jobLinks = await page.$$('a.job-card-container__link');
        logger.info(`Found ${jobLinks.length} job listings to process`);
        const jobs = [];

        for (const link of jobLinks) {
            try {
                await link.click();
        
                // Wait for job detail panel to appear
                const titleSelector = 'div.job-details-jobs-unified-top-card__job-title h1 a';
                await page.waitForSelector(titleSelector, { timeout: 20000 });
                const title = await page.textContent(titleSelector);

                const relativeHref = await page.getAttribute(titleSelector, 'href');
                const JobLink = `https://www.linkedin.com${relativeHref}`;
                logger.info(`Processing job: ${title}`);
                
                const companyNameSelector = 'div.job-details-jobs-unified-top-card__company-name a'
                await page.waitForSelector(companyNameSelector, { timeout: 20000 });
                const company = await page.textContent(companyNameSelector);
                logger.info(`Company: ${company}`);

                const locationSelector = 'div.job-details-jobs-unified-top-card__tertiary-description-container span span'
                await page.waitForSelector(locationSelector, { timeout: 20000 });
                const location = await page.textContent(locationSelector);
                // const description = await page.textContent('.jobs-description__content');
        
                jobs.push({ JobLink,title, company, location });
                logger.info(`Processed job: ${title} at ${company}`);
        
                // Small delay before moving to next job
                await page.waitForTimeout(1500);
        
            } catch (error) {
                logger.warn(`Failed to process a job listing: ${error.message}`);
            }
        }

        const fs = require('fs');
        fs.writeFileSync('jobs.json', JSON.stringify(jobs, null, 2));
        logger.info(`Successfully saved ${jobs.length} jobs to jobs.json`);

        await browser.close();
        logger.info('Browser closed, scraping completed successfully');
    } catch (error) {
        logger.error(`Script failed with error: ${error.message}`);
        throw error;
    }
}

main().catch(error => {
    logger.error(`Application error: ${error.message}`);
    process.exit(1);
});