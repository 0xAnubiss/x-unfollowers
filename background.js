chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== 'xtc-open-x') {
    return;
  }
  chrome.tabs.query({ url: ['*://x.com/*', '*://twitter.com/*'] }, (tabs) => {
    if (tabs && tabs[0]) {
      chrome.tabs.update(tabs[0].id, { active: true, url: tabs[0].url });
      if (tabs[0].windowId != null) chrome.windows.update(tabs[0].windowId, { focused: true });
      sendResponse({ ok: true, existing: true });
      return;
    }
    chrome.tabs.create({ url: 'https://x.com/following' }, () => {
      sendResponse({ ok: true, existing: false });
    });
  });
  return true;
});
