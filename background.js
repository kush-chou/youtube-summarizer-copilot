// background.js (v4.7 - Firefox)

// Listen for messages from our content script
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  let prompt = '';

  if (request.action === 'summarize_link') {
    console.log('[Controller] Received request to summarize link: ', request.url);
    prompt = `Please provide a concise summary of the key points from the following YouTube video: 

${request.url}`;
    openGeminiWithPrompt(prompt);
  } else if (request.action === 'summarize_transcript') {
    console.log('[Controller] Received full transcript to summarize.');
    prompt = `Please provide a concise summary of the key points from the following YouTube video transcript:

---

${request.data}

---`;
    openGeminiWithPrompt(prompt);
  } else if (request.action === 'start_scrape') {
    // This message comes from the UI button to the content script, which then sends the 'summarize_transcript' message.
    // We just need to forward the request to the active tab's content script.
    console.log('[Controller] Relaying "start scrape" command to content script.');
    browser.tabs.sendMessage(sender.tab.id, { action: "start_scrape" });
  }
});

// Listen for clicks on the browser action button
browser.action.onClicked.addListener((tab) => {
  if (tab.url && tab.url.includes("youtube.com/watch")) {
    console.log('[Controller] Browser action clicked on YouTube watch page.');
    // Send a message to the content script to summarize the current video link
    browser.tabs.sendMessage(tab.id, { action: 'summarize_link', url: tab.url });
  } else {
    console.log('[Controller] Browser action clicked on non-YouTube watch page.');
    // Optionally, open a new tab with YouTube or show a message
    browser.tabs.create({ url: "https://www.youtube.com" });
  }
});


function openGeminiWithPrompt(prompt) {
  // Store the prompt and open Gemini. The rest of the flow is the same.
  browser.storage.local.set({ fullPrompt: prompt }, () => {
    browser.tabs.create({ url: "https://gemini.google.com/gem/39f5525ff9d7" });
  });
}

// The listener that injects the Gemini automation script once the tab is ready.
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith("https://gemini.google.com/gem/39f5525ff9d7")) {
    console.log('[Controller] Gemini tab ready. Injecting automator.');
    browser.tabs.executeScript(tabId, {
      file: 'gemini_automator.js'
    }).catch(error => {
      console.error('[Controller] Error injecting script: ', error.message);
    });
  }
});