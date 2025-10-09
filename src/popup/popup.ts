// Ejemplo sencillo: guardar texto en chrome.storage
document.getElementById("guardar")!.addEventListener("click", async () => {
  // ejemplo: tomar la selección de la pestaña activa mediante messaging (simplificado)
  chrome.tabs.query({active: true, currentWindow: true}, tabs => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id! },
      func: () => window.getSelection()?.toString() || ""
    }, (res) => {
      const selected = res?.[0]?.result || "";
      if (selected) {
        chrome.storage.local.get({notes: []}, data => {
          const notes = data.notes;
          notes.push({text: selected, created: Date.now()});
          chrome.storage.local.set({notes});
          alert("Nota guardada");
        });
      } else alert("No hay selección");
    });
  });
});
