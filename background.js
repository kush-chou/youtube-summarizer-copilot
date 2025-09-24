// background.js (v4.8 - Firefox, Manifest V3)

// Listen for messages from our content script (from YouTube)
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  let prompt = "";

  if (request.action === "summarize_link") {
    console.log(
      "[Controller] Received request to summarize link: ",
      request.url,
    );
    prompt = `Please watch and provide a concise summary of the key points from the following YouTube video:

${request.url}`;
    openGeminiWithPrompt(prompt);
  } else if (request.action === "summarize_transcript") {
    console.log("[Controller] Received full transcript to summarize.");
    prompt = `Please provide a concise summary of the key points from the following YouTube video transcript:

---

${request.data}

---`;
    openGeminiWithPrompt(prompt);
  } else if (request.action === "start_scrape") {
    // This message comes from the UI button to the content script, which then sends the 'summarize_transcript' message.
    // We just need to forward the request to the active tab's content script.
    console.log(
      '[Controller] Relaying "start scrape" command to content script.',
    );
    browser.tabs.sendMessage(sender.tab.id, { action: "start_scrape" });
  }
});

// Listen for clicks on the browser action button
browser.action.onClicked.addListener((tab) => {
  if (tab.url && tab.url.includes("youtube.com/watch")) {
    console.log("[Controller] Browser action clicked on YouTube watch page.");
    // Send a message to the content script to summarize the current video link
    browser.tabs.sendMessage(tab.id, {
      action: "summarize_link",
      url: tab.url,
    });
  } else {
    console.log(
      "[Controller] Browser action clicked on non-YouTube watch page.",
    );
    // Optionally, open a new tab with YouTube or show a message
    browser.tabs.create({ url: "https://www.youtube.com" });
  }
});

async function openGeminiWithPrompt(prompt) {
  try {
    const data = await browser.storage.local.get("geminiId");
    const geminiId = data.geminiId;
    let geminiUrl = "https://gemini.google.com/";
    if (geminiId) {
      geminiUrl = `https://gemini.google.com/gem/${geminiId}`;
    }

    // Create the Gemini tab
    const geminiTab = await browser.tabs.create({ url: geminiUrl });

    // Add a listener that waits for this specific tab to finish loading
    const listener = (tabId, changeInfo, tab) => {
      // Make sure it's the correct tab and it's fully loaded
      if (
        tabId === geminiTab.id &&
        changeInfo.status === "complete" &&
        tab.url.startsWith("https://gemini.google.com/")
      ) {
        console.log("[Controller] Gemini tab is ready. Sending prompt.");

        // Send the prompt directly to the content script in that tab
        browser.tabs
          .sendMessage(tabId, {
            action: "inject_prompt",
            prompt: prompt,
          })
          .catch((error) => {
            console.error(
              "[Controller] Could not send prompt to Gemini tab:",
              error.message,
            );
          });

        // Clean up the listener to prevent it from running again
        browser.tabs.onUpdated.removeListener(listener);
      }
    };

    browser.tabs.onUpdated.addListener(listener);
  } catch (error) {
    console.error("[Controller] Error opening Gemini tab:", error);
  }
}
