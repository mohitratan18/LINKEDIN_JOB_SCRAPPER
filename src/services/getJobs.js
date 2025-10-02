const { response } = require("../helpers/response");
const { ScrapperModule } = require("../modules/scrapJobs_linkedin");
const logger = require('../helpers/logger/logger');

const getJobs = async ({ req, res }) => {
  try {
    logger.info("Starting to scrap jobs");
    const responseData = await ScrapperModule();
    logger.info("Scraping jobs completed");
    
    return response({
      res,
      req,
      data: responseData.data,
      status: responseData.status,
      message: responseData.data.length ? "Jobs fetched successfully" : "No jobs found",
      success: responseData.success
    });
  } catch (error) {
    logger.error(`Error in getJobs: ${error.message}`);
    return response({
      res,
      req,
      data: [],
      status: 500,
      message: "Internal server error",
      success: false
    });
  }
};

module.exports = { getJobs };
