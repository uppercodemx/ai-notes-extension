chrome.runtime.onInstalled.addListener(() => { console.log("FORAS instalado."); });
chrome.commands.onCommand.addListener((command) => { console.log("Comando:", command); });
