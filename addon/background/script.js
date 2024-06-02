"use strict";
import { getCodes, storeList, getList } from "/utils/storage.js";

var port = getNativePort();

// Script is only loaded on startup

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
    if (message.type === "siteLoaded") {
    	console.log("site loaded, fetching keys");
        fetch_keys(info, tab);    
    }
});

browser.runtime.onMessage.addListener((message) => {
    console.log("Received (browser): " + JSON.stringify(message));
    if (message.type === "siteLoaded") {
    	console.log("site loaded, fetching keys");
        fetch_keys();    
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
        fetch_keys();
      }
    }
  }
);

function fetch_keys() {
  let message = {
    "type": "fetchOtp"
  }
  console.log("Sent message: " + JSON.stringify((message)));
  port.postMessage(message);
}

function saveKeys(list) {
  storeList(list);
  let groupedList = getGroupedList();
    
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

async function getGroupedList() {
  /*
    let codes = await getCodes();
    let codesMap = new Map(codes.map(i => [i.domain, i.codeName]));
    
    // host now has the domain like www.google.com from https://www.google.com/myAccount.php
    return codesMap.get(host);
  */
  let list = await getList();
  
  let parsedList = [];

  list.forEach(element => {
    parsedList.push({domain: element.split(":")[0], user: element.split(":")[1]})
  });
  
  console.log("Parsed List: " + JSON.stringify(parsedList));

  const groupedByDomain = parsedList.reduce((acc, { domain, user }) => {
    if (!acc[domain]) {
      acc[domain] = [];
    }
    acc[domain].push(user);
    return acc;
  }, {});
  console.log("groupedList: " + groupedByDomain);
  console.log("Grouped list: " + JSON.stringify(groupedByDomain));
  console.log("Grouped List Size: " + groupedByDomain.Size)
  return groupedByDomain;

  /*let host = url.match(/:\/\/(.[^/]+)/)[1];
  let temp = findUsersByHost(host, groupedByDomain);
  let r_user = temp[1];
  let r_user_domain = temp[0];
  console.log("Relavant list: " + JSON.stringify(r_user));
  console.log("Relevant user:domains: " + JSON.stringify(r_user_domain));*/
}

// Function to extract the main domain by removing the subdomain
const extractMainDomain = (host) => {
    const parts = host.split('.');
    if (parts.length > 2) {
        return parts.slice(1).join('.');
    }
    return host;
};

// Function to find users by host and return in "host:username" format
const findUsersByHost = (host, groupedDomains) => {
    let keys = [];
    let users = [];  

    // Helper function to add results to the list
    const addResults = (domain) => {
        if (groupedDomains[domain]) {
            groupedDomains[domain].forEach(user => {
              keys.push(`${domain}:${user}`);
              users.push(user);
            });
        }
    };

    // Check for exact match first
    addResults(host);

    // Remove the prefix and check again if no results found
    if (keys.length === 0) {
        const mainDomain = extractMainDomain(host);
        addResults(mainDomain);
    }

    return [keys, users];
};

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
