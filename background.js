// Copyright (c) 2020 Theodore Dubois
// SPDX-License-Identifier: GPL-3.0-only

"use strict";

// Maintain a context menu item that lets you toggle whether the current tab is in a popup

let menuItemId = chrome.contextMenus.create({
    title: 'Move Tab to Popup',
    id: 'toggle popout',
    contexts: ['page'],
}, () => chrome.runtime.lastError);

const menuItemTitles = {
    normal: 'Move Tab to Popup',
    popup: 'Move Popup to Tab',
};
for (const [type, title] of Object.entries(menuItemTitles)) {
    chrome.windows.onFocusChanged.addListener(function() {
        chrome.contextMenus.update(menuItemId, {title});
    }, {windowTypes: [type]});
}

chrome.contextMenus.onClicked.addListener(function(info, tab) {
    togglePopout(tab);
});
chrome.browserAction.onClicked.addListener(function(tab) {
    togglePopout(tab);
});

// Map to track which window a popup came from
let tabOrigins = new Map();
chrome.tabs.onRemoved.addListener(function(tab) {
    tabOrigins.delete(tab.id);
});

// Code to actually toggle the popup

function togglePopout(tab) {
    chrome.windows.get(tab.windowId, {}, function(window) {
        let originWindowExists = false;
        if (tabOrigins.has(tab.id)) {
            chrome.windows.get(tabOrigins.get(tab.id).window, {}, function() {
                if (chrome.runtime.lastError === undefined)
                    originWindowExists = true;
                realTogglePopout(tab, window, originWindowExists);
            });
        } else {
            realTogglePopout(tab, window, originWindowExists);
        }
    });
}

function realTogglePopout(tab, window, originWindowExists) {
    if (window.type === 'popup' && originWindowExists) {
        // might be able to put the tab back where it came from
        let tabOrigin = tabOrigins.get(tab.id);
        // TODO: be smart about the tab index
        chrome.tabs.move(tab.id, {
            windowId: tabOrigin.window,
            index: tabOrigin.pinned ? 0 : -1,
        }, () => chrome.tabs.update(tab.id, {
            active: true,
            pinned: tabOrigin.pinned,
        }));
        tabOrigins.delete(tab.id);
        return;
    }

    let newType;
    if (window.type === 'normal')
        newType = 'popup';
    else if (window.type === 'popup')
        newType = 'normal';

    tabOrigins.set(tab.id, {
        window: window.id,
        pinned: tab.pinned,
    });
    chrome.windows.create({
        tabId: tab.id,
        type: newType,
        top: window.top,
        left: window.left,
        width: window.width,
        height: window.height,
    });
}
