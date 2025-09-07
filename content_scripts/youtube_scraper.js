// youtube_scraper.js (v4.5 - Firefox)

// --- Utilities ---
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


// --- Button Creation ---
function createSummarizeButton(isThumbnail) {
    const button = document.createElement('button');
    button.className = isThumbnail ? 'thumbnail-btn' : 'summarizer-btn';

    button.appendChild(document.createTextNode('Summarize Link'));

    button.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        
        let videoUrl = '';
        if (isThumbnail) {
            // Find the closest 'a' tag which acts as the link for the thumbnail.
            const linkElement = e.target.closest('a#thumbnail');
            if (linkElement && linkElement.href) {
                videoUrl = new URL(linkElement.getAttribute('href'), window.location.origin).href;
            } else {
                 console.error('[Summarizer] Could not find video link from thumbnail.');
                 return;
            }
        } else {
            // On the watch page, the URL is simply the current page's URL.
            videoUrl = window.location.href;
        }
        
        if (videoUrl) {
            browser.runtime.sendMessage({ action: 'summarize_link', url: videoUrl });
        }
    });
    return button;
}

function createTranscriptButton() {
    const button = document.createElement('button');
    button.className = 'summarizer-btn';
    button.textContent = 'Summarize Transcript';

    button.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        browser.runtime.sendMessage({ action: 'start_scrape' });
    });
    return button;
}


// --- Injection Logic ---

function injectButtonsOnWatchPage() {
    const buttonContainer = document.querySelector('#actions #menu-container');
    
    if (buttonContainer && !buttonContainer.querySelector('.summarizer-btn')) {
        console.log('[Summarizer] Injecting buttons on watch page.');
        const linkButton = createSummarizeButton(false);
        const transcriptButton = createTranscriptButton();

        buttonContainer.prepend(transcriptButton);
        buttonContainer.prepend(linkButton);
    }
}

function injectButtonsOnThumbnails(node) {
    const thumbnails = node.querySelectorAll('ytd-thumbnail:not([data-summarizer-injected])');
    thumbnails.forEach(thumb => {
        thumb.dataset.summarizerInjected = 'true'; // Mark as processed

        const button = createSummarizeButton(true);
        thumb.classList.add('thumbnail-wrapper');
        thumb.appendChild(button);

        // This observer will re-inject the button if the thumbnail's contents change (e.g., video preview starts)
        const observer = new MutationObserver((mutations) => {
            if (!thumb.querySelector('.thumbnail-btn')) {
                thumb.appendChild(button);
            }
        });

        observer.observe(thumb, { childList: true });
    });
}

// --- Main Execution ---

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
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "start_scrape") {
    scrapeTranscriptAndSend();
  }
});

async function scrapeTranscriptAndSend() {
    try {
        // Click the description expander to reveal the "Show transcript" button
        const expander = document.querySelector("#description-inline-expander #expand");
        if (expander) expander.click();

        // Wait for and click the "Show transcript" button
        const button = await waitForElement('ytd-video-description-transcript-section-renderer button');
        button.click();

        // Wait for the transcript panel to appear
        const transcriptContainer = await waitForElement('ytd-transcript-renderer');
        
        // Wait for the transcript segments to be loaded
        await waitForElement('ytd-transcript-segment-renderer yt-formatted-string');

        const segments = transcriptContainer.querySelectorAll("ytd-transcript-segment-renderer yt-formatted-string");
        if (segments.length === 0) throw new Error("Transcript segments are empty.");

        const transcriptText = Array.from(segments).map(s => s.textContent.trim()).join(' ');
        
        browser.runtime.sendMessage({ action: 'summarize_transcript', data: transcriptText });
    } catch (error) {
        console.error("[YT Scraper] Transcript scrape error:", error.message);
        alert(`Could not scrape transcript: ${error.message}`);
    }
}

// YouTube uses single-page navigation, so we need to re-run our injection logic
// when the user navigates to a new page.
document.addEventListener('yt-navigate-finish', runInjection);
