const hint = document.getElementById('hint');

document.getElementById('open-panel').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab && tab.url ? tab.url : '';
  const onX = /https?:\/\/(x|twitter)\.com\//i.test(url);

  if (!onX) {
    hint.textContent = 'x.com açılıyor. Giriş yaptıktan sonra eklenti simgesine tekrar bas.';
    chrome.runtime.sendMessage({ type: 'xtc-open-x' });
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'xtc-toggle-panel' });
    window.close();
  } catch (_) {
    hint.textContent = 'Sayfayı yenile, sonra tekrar dene. İlk yüklemede x.com’u açık tutman gerekir.';
  }
});
