// gemini_automator.js

const automateGemini = async () => {
    const result = await chrome.storage.local.get('fullPrompt');
    const prompt = result.fullPrompt;

    if (!prompt) {
        console.error('[Gemini Automator] Could not retrieve prompt.');
        return;
    }

    const waitForElement = (selector) => new Promise((resolve, reject) => {
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
        const promptBox = await waitForElement('div.ql-editor[contenteditable="true"]');
        promptBox.focus();
        promptBox.textContent = prompt;
        promptBox.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));

        await new Promise(resolve => setTimeout(resolve, 500));

        const submitButton = await waitForElement('button[aria-label="Send message"]:not([disabled])');
        submitButton.click();
        
        chrome.storage.local.remove('fullPrompt');
    } catch (error) {
        console.error('[Gemini Automator] Failed:', error);
        alert(`Gemini Automation Failed: ${error.message}\nThe prompt is on your clipboard. Please paste it manually.`);
        navigator.clipboard.writeText(prompt);
    }
};

automateGemini();
