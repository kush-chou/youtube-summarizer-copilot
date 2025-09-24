// Saves options to browser.storage
function saveOptions(e) {
  e.preventDefault();
  const geminiId = document.getElementById("geminiId").value;

  browser.storage.local.set({
    geminiId: geminiId
  }).then(() => {
    // Update status to let user know options were saved.
    const status = document.getElementById("status");
    status.textContent = "ID saved successfully!";
    setTimeout(() => {
      status.textContent = "";
    }, 1500);
  }, (error) => {
    const status = document.getElementById("status");
    status.textContent = `Error: ${error}`;
    status.style.color = 'red';
  });
}

// Restores the saved Gemini ID from browser.storage.
function restoreOptions() {
  function setCurrentChoice(result) {
    document.getElementById("geminiId").value = result.geminiId || "";
  }

  function onError(error) {
    console.log(`Error: ${error}`);
  }

  let getting = browser.storage.local.get("geminiId");
  getting.then(setCurrentChoice, onError);
}

document.addEventListener("DOMContentLoaded", restoreOptions);
document.getElementById("save").addEventListener("click", saveOptions);
