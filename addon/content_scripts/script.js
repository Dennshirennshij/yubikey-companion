"use strict";

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    // Send a message to content script to update context menu based on the new tab
    sendUpdate();
  }
});

function sendUpdate() {
  browser.runtime.sendMessage({type: "siteLoaded"});
}

