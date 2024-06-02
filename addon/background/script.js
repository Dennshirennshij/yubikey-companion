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

async function saveKeys(list) {
  storeList(list);
  let groupedList = await getGroupedList(list);
  let keys = Object.keys(groupedList);
  console.log(keys);
  keys.forEach(key => {
    let allowed_domains = [];
    if (key.split(".").length===2) {
      // example: google.com
      allowed_domains.push("https://" + key + "/*");  // https://domain.com/*
      allowed_domains.push("http://" + key + "/*");   // http://domain.com/*
      allowed_domains.push("https://*." + key + "/*");// https://account.google.com/*
      allowed_domains.push("http://*." + key + "/*"); // http://accounts.google.com/*
      console.log("For domain " + key + ": " + allowed_domains);
    } else {
      // example: accounts.google.com
      allowed_domains.push("https://" + key + "/*");
      allowed_domains.push("http://" + key + "/*");
      console.log("For subdomain " + key + ": " + allowed_domains);
    }
    
    let usernames = groupedList[key];
    console.log(usernames);
    
    
    usernames.forEach(user => {
      console.log(user);
      browser.menus.create(
        {
          id: "generate-otp:" + key + ":" + user,
          title: user,
          documentUrlPatterns: allowed_domains,
          contexts: ["editable"],
          onclick(info,tab) {
            generateOtp(info,tab, key + ":" + user);
          }
        }
      );
    });

  })
}

function getNativePort() {
    return browser.runtime.connectNative("yubikey_bridge");
}

async function generateOtp(info, tab, keyName) {
    let targetParams = getTargetParams(info, tab);
    let message = {
        "type": "generateOtp",
        "target": targetParams,
        "keyName": keyName
    };
    console.log("Sent message: " + JSON.stringify(message));
    port.postMessage(message);
}

async function getGroupedList(list) {
  /*
    let codes = await getCodes();
    let codesMap = new Map(codes.map(i => [i.domain, i.codeName]));
    
    // host now has the domain like www.google.com from https://www.google.com/myAccount.php
    return codesMap.get(host);
  */
  
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
  console.log("Grouped list: " + JSON.stringify(groupedByDomain));
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
