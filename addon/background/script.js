"use strict";
import { getCodes, storeList, getList } from "/utils/storage.js";

var port = getNativePort();

port.onMessage.addListener((message) => {
    console.log("Received: " + JSON.stringify(message));
    if (message.type === "otpResponse") {
        injectOtp(message["target"], message["otp"]);
    }
    if (message.type === "otpNotFound") {
        console.warn("Couldn't find the oath account with the key");
    }
    if (message.type === "keysListing") {
        saveKeys(message["list"]);
    }
});

browser.menus.create({
    id: "generate-otp",
    title: "Generate OTP",
    documentUrlPatterns: ["https://*/*", "http://*/*"],
    contexts: ["editable"],
    onclick(info, tab) {
        if (info.menuItemId === "generate-otp") {
            generateOtp(info, tab);
        }
    }
});

browser.menus.create(
  {
    id: "reload-keys",
    title: "Reload Accounts List",
    documentUrlPatterns: ["https://*/*", "http://*/*"],
    contexts: ["editable"],
    onclick(info,tab) {
      if (info.menuItemId === "reload-keys") {
        let targetParams = getTargetParams(info, tab);
        let message = {
          "type": "fetchOtp",
          "target": targetParams
        }
        console.log("Sent message: " + JSON.stringify((message)));
        port.postMessage(message);
      }
    }
  }
);

function saveKeys(list) {
  storeList(list);
}

function getNativePort() {
    return browser.runtime.connectNative("yubikey_bridge");
}

async function generateOtp(info, tab) {
    let targetParams = getTargetParams(info, tab);
    let keyName = await getKeyName(info["pageUrl"]);
    let message = {
        "type": "generateOtp",
        "target": targetParams,
        "keyName": keyName
    };
    console.log("Sent message: " + JSON.stringify(message));
    port.postMessage(message);
}

async function getKeyName(url) {
  /*
    let codes = await getCodes();
    let codesMap = new Map(codes.map(i => [i.domain, i.codeName]));
    let host = url.match(/:\/\/(.[^/]+)/)[1];
    // host now has the domain like www.google.com from https://www.google.com/myAccount.php
    return codesMap.get(host);
  */
  let list = await getList();
  
  const parsedList = list.map(item => {
    const [domain, user] = item.split(':');
    return { domain, user };
  });

  const groupedByDomain = parsedList.reduce((acc, { domain, user }) => {
    if (!acc[domain]) {
      acc[domain] = [];
    }
    acc[domain].push(user);
    return acc;
  }, {});
  console.log("Grouped list: " + JSON.stringify(groupedByDomain));
}

function getTargetParams(info, tab) {
    return {
        tabId: tab.id,
        frameId: info.frameId,
        targetElementId: info.targetElementId,
    };
}

async function injectOtp(targetParams, otp) {
    await browser.tabs.executeScript(targetParams.tabId, {
        runAt: "document_start",
        frameId: targetParams.frameId,
        file: "/content_scripts/content.js",
    });
    await browser.tabs.sendMessage(targetParams.tabId, {
        "targetElementId": targetParams["targetElementId"],
        "otp": otp
    });
}
