// youtube_scraper.js (v4.4)

// --- Button Creation ---
function createSummarizeButton(isThumbnail) {
    const button = document.createElement('button');
    button.className = isThumbnail ? 'thumbnail-btn' : 'summarizer-btn';

    if (isThumbnail) {
        const icon = document.createElement('img');
        icon.src = chrome.runtime.getURL('icons/summarize-icon.svg');
        button.appendChild(icon);
    }

    button.appendChild(document.createTextNode('Summarize Link'));

    // Set a data attribute to identify the action.
    button.dataset.action = 'summarize_link';
    button.dataset.isThumbnail = isThumbnail;

    return button;
}

function createTranscriptButton() {
    const button = document.createElement('button');
    button.className = 'summarizer-btn';
    button.textContent = 'Summarize Transcript';

    // Set a data attribute to identify the action for the main listener.
    button.dataset.action = 'start_scrape';
    return button;
}


// --- Injection Logic ---

function injectButtonsOnWatchPage() {
    // This function is now disabled.
}

function injectButtonsOnThumbnails(node) {
    const thumbnails = node.querySelectorAll('ytd-thumbnail:not([data-summarizer-injected])');
    thumbnails.forEach(thumb => {
        thumb.classList.add('thumbnail-wrapper');
        const button = createSummarizeButton(true);
        thumb.appendChild(button);
        thumb.dataset.summarizerInjected = 'true';
    });
}

// --- Main Execution ---

// Add a single event listener to the body to handle all clicks.
// This is more CSP-compliant than adding inline listeners.
document.body.addEventListener('click', (e) => {
    const summarizeLinkButton = e.target.closest('[data-action="summarize_link"]');
    const transcriptButton = e.target.closest('[data-action="start_scrape"]');

    if (summarizeLinkButton) {
        e.stopPropagation();
        e.preventDefault();

        let videoUrl = '';
        const isThumbnail = summarizeLinkButton.dataset.isThumbnail === 'true';

        if (isThumbnail) {
            // Find the parent renderer component that contains the video info.
            const renderer = summarizeLinkButton.closest(
                'ytd-rich-item-renderer, ytd-grid-video-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-playlist-panel-video-renderer'
            );
            
            // Find the canonical link element within the renderer.
            const linkElement = renderer ? renderer.querySelector('a#thumbnail') : null;

            if (linkElement && linkElement.href) {
                videoUrl = new URL(linkElement.href, window.location.origin).href;
            } else {
                console.error('[Summarizer] Could not find valid video link from thumbnail container.');
                return;
            }
        } else {
            // This is for the watch page, where the URL is the current page.
            videoUrl = window.location.href;
        }

        if (videoUrl) {
            chrome.runtime.sendMessage({ action: 'summarize_link', url: videoUrl });
        }
    } else if (transcriptButton) {
        e.stopPropagation();
        e.preventDefault();
        chrome.runtime.sendMessage({ action: 'start_scrape' });
    }
});

function runInjection() {
    if (window.location.href.includes('/watch')) {
        injectButtonsOnWatchPage();
    } else {
        injectButtonsOnThumbnails(document);
    }
}

// Initial run
runInjection();

// Observe the page for changes (infinite scroll, navigation)
const observer = new MutationObserver((mutations) => {
    runInjection();
});

observer.observe(document.body, { childList: true, subtree: true });

// Listen for scrape requests originating from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "start_scrape") {
    scrapeTranscriptAndSend();
  }
});

async function scrapeTranscriptAndSend() {
    try {
        const expander = document.querySelector("#description-inline-expander #expand");
        if (expander) expander.click();

        const button = document.querySelector("ytd-video-description-transcript-section-renderer button");
        if (!button) throw new Error("Transcript button not found in description.");
        button.click();

        const transcriptContainer = await new Promise(resolve => setTimeout(() => resolve(document.querySelector('ytd-transcript-renderer')), 500));
        if (!transcriptContainer) throw new Error("Transcript panel did not appear.");
        
        const segments = transcriptContainer.querySelectorAll("ytd-transcript-segment-renderer yt-formatted-string");
        if (segments.length === 0) throw new Error("Transcript segments are empty.");

        const transcriptText = Array.from(segments).map(s => s.textContent.trim()).join(' ');
        
        chrome.runtime.sendMessage({ action: 'summarize_transcript', data: transcriptText });
    } catch (error) {
        console.error("[YT Scraper] Transcript scrape error:", error.message);
        alert(`Could not scrape transcript: ${error.message}`);
    }
}