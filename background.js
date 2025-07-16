// background.js (v4.1 - Router Logic)

// Listen for messages from our content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  let prompt = '';

  if (request.action === 'summarize_link') {
    console.log('[Controller] Received request to summarize link: ', request.url);
    prompt = `Please provide a concise summary of the key points from the following YouTube video: \n\n${request.url}`;
    openGeminiWithPrompt(prompt);
  } else if (request.action === 'summarize_transcript') {
    console.log('[Controller] Received full transcript to summarize.');
    prompt = `Please provide a concise summary of the key points from the following YouTube video transcript:\n\n---\n\n${request.data}\n\n---`;
    openGeminiWithPrompt(prompt);
  } else if (request.action === 'start_scrape') {
    // This message comes from the UI button to the content script, which then sends the 'summarize_transcript' message.
    // We just need to forward the request to the active tab's content script.
    console.log('[Controller] Relaying "start scrape" command to content script.');
    chrome.tabs.sendMessage(sender.tab.id, { action: "start_scrape" });
  }
});

function openGeminiWithPrompt(prompt) {
  // Store the prompt and open Gemini. The rest of the flow is the same.
  chrome.storage.local.set({ fullPrompt: prompt }, () => {
    chrome.tabs.create({ url: "https://gemini.google.com/app" });
  });
}

// The listener that injects the Gemini automation script once the tab is ready.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith("https://gemini.google.com/app")) {
    console.log('[Controller] Gemini tab ready. Injecting automator.');
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content_scripts/gemini_automator.js']
    }).then(() => {
      console.log('Successfully injected gemini_automator.js');
    }).catch(err => {
      console.error('Failed to inject gemini_automator.js:', err);
    });
  }
});