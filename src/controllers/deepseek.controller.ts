import { Request, Response, NextFunction } from 'express';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import path from 'path';

puppeteer.use(StealthPlugin());

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const setTextareaValue = async (page: any, selector: string, value: string): Promise<void> => {
  await page.evaluate((inputSelector: string, inputValue: string) => {
    const textarea = document.querySelector(inputSelector) as HTMLTextAreaElement | null;
    if (!textarea) {
      throw new Error('DeepSeek input textarea was not found');
    }

    const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (!valueSetter) {
      throw new Error('Textarea value setter was not found');
    }

    textarea.focus();
    valueSetter.call(textarea, '');
    textarea.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));

    valueSetter.call(textarea, inputValue);
    textarea.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      data: inputValue,
      inputType: 'insertFromPaste',
    }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
  }, selector, value);
};

const waitForTextareaValue = async (page: any, selector: string, expectedLength: number): Promise<void> => {
  const timeoutMs = 30000;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const currentLength = await page.evaluate((inputSelector: string) => {
      const textarea = document.querySelector(inputSelector) as HTMLTextAreaElement | null;
      return textarea?.value.length || 0;
    }, selector);

    if (currentLength === expectedLength) {
      return;
    }

    await delay(500);
  }

  throw new Error('Full prompt was not pasted into DeepSeek input');
};

const getLatestAssistantResponse = async (page: any): Promise<string> => {
  return page.evaluate(() => {
    const selectors = [
      '.ds-markdown',
      '[class*="markdown"]',
      '[data-message-author-role="assistant"]',
      '[class*="assistant"]',
    ];

    const candidates = selectors
      .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
      .map((element) => (element.textContent || '').trim())
      .filter(Boolean);

    return candidates[candidates.length - 1] || '';
  });
};

const waitForGeneratedResponse = async (page: any, previousAssistantResponse: string): Promise<string> => {
  const timeoutMs = 180000;
  const startedAt = Date.now();
  let previousResponse = previousAssistantResponse;
  let stableChecks = 0;

  while (Date.now() - startedAt < timeoutMs) {
    await delay(2000);

    const responseText = await getLatestAssistantResponse(page);
    if (!responseText || responseText === previousAssistantResponse) {
      continue;
    }

    if (responseText === previousResponse) {
      stableChecks += 1;
    } else {
      previousResponse = responseText;
      stableChecks = 0;
    }

    if (stableChecks >= 2) {
      return responseText;
    }
  }

  throw new Error('Timed out waiting for DeepSeek to generate a response');
};

export const sendToDeepSeek = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { html, defaultPrompt } = req.body;

  if (!html || !defaultPrompt) {
    res.status(400).json({ success: false, message: 'html and defaultPrompt are required in form-data' });
    return;
  }

  let browser = null;
  try {
    // We launch in non-headless mode so it seamlessly uses your login session
    // without triggering headless bot detections from Cloudflare.
    browser = await puppeteer.launch({
      headless: false,
      executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", // Use real Chrome
      userDataDir: path.resolve('./user_data'), // Use absolute path
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    
    console.log('[DeepSeek] Navigating to chat...');
    await page.goto('https://chat.deepseek.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Wait for the textarea to appear
    console.log('[DeepSeek] Waiting for the chat input box...');
    const textareaSelector = 'textarea[placeholder="Message DeepSeek"]';
    await page.waitForSelector(textareaSelector, { timeout: 60000 });

    const fullMessage = `${defaultPrompt}\n\n${html}`;
    const previousAssistantResponse = await getLatestAssistantResponse(page);

    console.log('[DeepSeek] Waiting before pasting the prompt...');
    await delay(2000);
    await page.focus(textareaSelector);
    console.log('[DeepSeek] Pasting the full prompt...');
    await setTextareaValue(page, textareaSelector, fullMessage);
    await waitForTextareaValue(page, textareaSelector, fullMessage.length);
    console.log('[DeepSeek] Full prompt pasted. Waiting before sending...');
    await delay(2000);
    await page.focus(textareaSelector);
    await page.keyboard.press('Enter');

    console.log('[DeepSeek] Message sent. Waiting for generated response...');
    const generatedResponse = await waitForGeneratedResponse(page, previousAssistantResponse);

    res.status(200).json({
      success: true,
      message: 'DeepSeek generated a response successfully',
      data: generatedResponse,
    });
  } catch (error) {
    next(error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};
