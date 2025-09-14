// youtube_scraper.js (v4.7 - Firefox)

// --- Utilities ---
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

// --- Button/Menu Item Creation ---

// Creates a standard YouTube-style button for the watch page
function createSummarizeButton() {
  const button = document.createElement("button");
  button.className = "summarizer-btn";
  button.textContent = "Summarize Link";

  button.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    const videoUrl = window.location.href;
    if (videoUrl) {
      browser.runtime.sendMessage({ action: "summarize_link", url: videoUrl });
    }
  });
  return button;
}

// Creates a standard YouTube-style button for the watch page
function createTranscriptButton() {
  const button = document.createElement("button");
  button.className = "summarizer-btn";
  button.textContent = "Summarize Transcript";

  button.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    browser.runtime.sendMessage({ action: "start_scrape" });
  });
  return button;
}

// Creates a YouTube-style menu item for the 3-dot menus
function createMenuItem(text, action, videoUrl = null) {
  const menuItem = document.createElement("ytd-menu-service-item-renderer");
  menuItem.className = "summarizer-menu-item";
  // Programmatically create elements to avoid innerHTML security risks.
  const paperItem = document.createElement("tp-yt-paper-item");
  paperItem.className = "ytd-menu-service-item-renderer";
  paperItem.setAttribute("role", "menuitem");
  paperItem.setAttribute("tabindex", "-1");

  const formattedString = document.createElement("yt-formatted-string");
  formattedString.className = "ytd-menu-service-item-renderer style-scope";
  formattedString.textContent = text;

  paperItem.appendChild(formattedString);
  menuItem.appendChild(paperItem);
  menuItem.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (action === "summarize_link_menu" && videoUrl) {
      browser.runtime.sendMessage({ action: "summarize_link", url: videoUrl });
    } else if (action === "summarize_transcript_menu") {
      browser.runtime.sendMessage({ action: "start_scrape" });
    }
  });
  return menuItem;
}

// --- Injection Logic ---

function injectButtonsOnWatchPage() {
  // Target the main actions container on the watch page
  const actionsContainer = document.querySelector(
    "#actions.ytd-watch-metadata",
  );
  if (actionsContainer && !actionsContainer.querySelector(".summarizer-btn")) {
    console.log("[Summarizer] Injecting buttons on watch page.");
    const linkButton = createSummarizeButton();
    const transcriptButton = createTranscriptButton();

    // Find the menu renderer to prepend our buttons
    const menuRenderer = actionsContainer.querySelector("ytd-menu-renderer");
    if (menuRenderer) {
      menuRenderer.prepend(transcriptButton);
      menuRenderer.prepend(linkButton);
    } else {
      // Fallback if menu-renderer is not found, append to actions container
      actionsContainer.prepend(transcriptButton);
      actionsContainer.prepend(linkButton);
    }
  }
}

function injectMenuItemsOnThumbnails(node) {
  const menuButtons = node.querySelectorAll(
    "ytd-menu-renderer.ytd-grid-video-renderer:not([data-summarizer-injected])",
  );
  menuButtons.forEach((menuButton) => {
    menuButton.dataset.summarizerInjected = "true"; // Mark as processed

    // Find the actual button that opens the menu
    const threeDotButton = menuButton.querySelector("yt-icon-button");
    if (threeDotButton) {
      threeDotButton.addEventListener(
        "click",
        () => {
          // Use a MutationObserver to wait for the menu to open
          const observer = new MutationObserver((mutations, obs) => {
            const menuPopup = document.querySelector(
              "tp-yt-paper-listbox.ytd-menu-renderer",
            );
            if (menuPopup) {
              // Check if our menu item is already there
              if (!menuPopup.querySelector(".summarizer-menu-item")) {
                const videoElement = menuButton.closest(
                  "ytd-grid-video-renderer, ytd-compact-video-renderer, ytd-rich-grid-media",
                );
                let videoUrl = "";
                if (videoElement) {
                  const linkElement = videoElement.querySelector("a#thumbnail");
                  if (linkElement && linkElement.href) {
                    videoUrl = new URL(
                      linkElement.getAttribute("href"),
                      window.location.origin,
                    ).href;
                  }
                }
                if (videoUrl) {
                  const summarizeLinkItem = createMenuItem(
                    "Summarize Link",
                    "summarize_link_menu",
                    videoUrl,
                  );
                  menuPopup.prepend(summarizeLinkItem);
                }
              }
              obs.disconnect(); // Disconnect observer once menu is found and item injected
            }
          });
          observer.observe(document.body, { childList: true, subtree: true });
        },
        { once: true },
      ); // Use { once: true } to prevent multiple listeners
    }
  });
}

// --- Main Execution ---

// Define a placeholder for the observer that will watch for page changes.
let observer;

function runInjection() {
  // Temporarily disconnect the observer to prevent an infinite loop.
  // This is crucial because our injection logic modifies the DOM, which would
  // otherwise re-trigger the observer.
  if (observer) observer.disconnect();

  if (window.location.href.includes("/watch")) {
    injectButtonsOnWatchPage();
  } else {
    injectMenuItemsOnThumbnails(document);
  }

  // Reconnect the observer to watch for future page changes made by YouTube
  // (e.g., loading more videos on the homepage).
  if (observer)
    observer.observe(document.body, { childList: true, subtree: true });
}

// Run injections on initial load and on YouTube's single-page navigation events.
runInjection();
document.addEventListener("yt-navigate-finish", runInjection);

// Set up the observer to handle dynamic content loading (e.g., infinite scroll).
// It calls runInjection, which contains the disconnect/reconnect logic.
observer = new MutationObserver(runInjection);
observer.observe(document.body, { childList: true, subtree: true });

// Listen for scrape requests originating from the background script
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "start_scrape") {
    scrapeTranscriptAndSend();
  }
});

async function scrapeTranscriptAndSend() {
  try {
    // Click the description expander to reveal the "Show transcript" button
    const expander = document.querySelector(
      "#description-inline-expander #expand",
    );
    if (expander) expander.click();

    // Wait for and click the "Show transcript" button
    const button = await waitForElement(
      "ytd-video-description-transcript-section-renderer button",
    );
    button.click();

    // Wait for the transcript panel to appear
    const transcriptContainer = await waitForElement("ytd-transcript-renderer");

    // Wait for the transcript segments to be loaded
    await waitForElement("ytd-transcript-segment-renderer yt-formatted-string");

    const segments = transcriptContainer.querySelectorAll(
      "ytd-transcript-segment-renderer yt-formatted-string",
    );
    if (segments.length === 0)
      throw new Error("Transcript segments are empty.");

    const transcriptText = Array.from(segments)
      .map((s) => s.textContent.trim())
      .join(" ");

    browser.runtime.sendMessage({
      action: "summarize_transcript",
      data: transcriptText,
    });
  } catch (error) {
    console.error("[YT Scraper] Transcript scrape error:", error.message);
    alert(`Could not scrape transcript: ${error.message}`);
  }
}
