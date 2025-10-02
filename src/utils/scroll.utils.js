const logger = require("../helpers/logger/logger");

const autoScrollUntilEnd = async (page) => {
  return await page
    .evaluate(async () => {
      let scrollable = document.querySelector(
        ".scaffold-layout__list-container"
      );
      if (!scrollable) {
        const sentinel = document.querySelector(
          "div[data-results-list-top-scroll-sentinel]"
        );
        if (sentinel) scrollable = sentinel.parentElement;
      }
      if (!scrollable) return { error: "Could not find scrollable element" };

      let lastHeight = 0;
      let sameCount = 0;
      let scrollAttempts = 0;
      const maxAttempts = 50;

      while (sameCount < 3 && scrollAttempts < maxAttempts) {
        const scrollTop = scrollable.scrollTop;
        scrollable.scrollTop = scrollTop + 1000;
        await new Promise((r) => setTimeout(r, 1500));
        const newHeight = scrollable.scrollHeight;

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
        attempts: scrollAttempts,
      };
    })
    .then((result) => {
      if (result.error) {
        logger.error(result.error);
      } else {
        logger.info(`Scrolling complete after ${result.attempts} attempts`);
      }
    });
};

module.exports = { autoScrollUntilEnd };