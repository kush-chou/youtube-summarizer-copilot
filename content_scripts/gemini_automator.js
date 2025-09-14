// gemini_automator.js (v4.8 - Firefox, Manifest V3)

// This script now waits for a message from the background script
// instead of checking storage on its own.

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "inject_prompt" && request.prompt) {
    console.log("[Gemini Automator] Received prompt. Starting automation.");
    automateGemini(request.prompt);
    // Return true to indicate that we will send a response asynchronously.
    // This is good practice, though not strictly necessary here.
    return true;
  }
});

const automateGemini = async (prompt) => {
  const waitForElement = (selector) =>
    new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        const el = document.querySelector(selector);
        if (el) {
          clearInterval(interval);
          resolve(el);
        }
      }, 300);
      setTimeout(() => {
        clearInterval(interval);
        reject(new Error(`Timed out waiting for: ${selector}`));
      }, 10000);
    });

  try {
    // This selector targets the rich text editor where the prompt is entered.
    const promptBox = await waitForElement(
      'div.ql-editor[contenteditable="true"]',
    );
    promptBox.focus();
    promptBox.innerText = prompt;
    promptBox.dispatchEvent(
      new Event("input", { bubbles: true, cancelable: true }),
    );

    await new Promise((resolve) => setTimeout(resolve, 500));

    // This selector targets the send button, ensuring it is not disabled.
    const submitButton = await waitForElement(
      'button[aria-label="Send message"]:not([disabled])',
    );
    submitButton.click();
  } catch (error) {
    console.error("[Gemini Automator] Failed:", error);
    alert(
      `Gemini Automation Failed: ${error.message}\nThe prompt is on your clipboard. Please paste it manually.`,
    );
    // Fallback: copy the prompt to the clipboard for the user
    navigator.clipboard.writeText(prompt);
  }
};
