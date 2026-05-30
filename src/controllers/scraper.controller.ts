import { Request, Response, NextFunction } from "express";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

// Add stealth plugin to puppeteer
puppeteer.use(StealthPlugin());

export const extractHtml = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const { url } = req.body;

  if (!url || typeof url !== "string") {
    res.status(400).json({
      success: false,
      message: "URL is required in the payload and must be a string",
    });
    return;
  }

  let browser = null;
  try {
    // Launch a "real browsing" instance
    browser = await puppeteer.launch({
      headless: true, // using true allows it to run smoothly on servers, stealth plugin masks it
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    // Set a realistic viewport
    await page.setViewport({ width: 1280, height: 720 });

    // Block heavy resources (images, css, fonts, media) to speed up loading
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const resourceType = req.resourceType();
      if (["image", "stylesheet", "font", "media"].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    try {
      // Go to the URL (faster load by not waiting for all network requests)
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    } catch (e: any) {
      // If it times out, the page has often loaded enough content to extract text anyway
      if (e.message && e.message.toLowerCase().includes("timeout")) {
        console.log(
          `[Scraper] Timeout reached for ${url}, extracting available content...`,
        );
      } else {
        throw e;
      }
    }

    // Extract only the text of the page
    const textContent = await page.evaluate(() => {
      // Return the innerText of the body, which excludes scripts and styles
      return document.body.innerText;
    });

    res.status(200).json({
      success: true,
      url,
      data: textContent,
    });
  } catch (error) {
    next(error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};
