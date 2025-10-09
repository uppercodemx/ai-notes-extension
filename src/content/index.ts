import { getItem, update } from "../utils/storage";
import type { Note } from "../types/note";

const NOTES_KEY = "foras.notes";
let fab: HTMLButtonElement | null = null;
let panelEl: HTMLDivElement | null = null;

function getSelectionText(): string {
  const sel = window.getSelection();
  return sel ? sel.toString().trim() : "";
}
function selectionRect(): DOMRect | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0).cloneRange();
  if (range.collapsed) return null;
  const rect = range.getBoundingClientRect();
  return rect;
}
function ensureFab() {
  if (fab) return fab;
  fab = document.createElement("button");
  fab.className = "foras-fab";
  fab.textContent = "Guardar con FORAS";
  fab.style.display = "none";
  document.documentElement.appendChild(fab);
  fab.addEventListener("click", openSaveModalFromSelection);
  return fab;
}
function positionFab() {
  const rect = selectionRect();
  const btn = ensureFab();
  if (!rect) { btn.style.display = "none"; return; }
  btn.style.display = "block";
  btn.style.top = window.scrollY + rect.bottom + 6 + "px";
  btn.style.left = window.scrollX + rect.left + "px";
}
document.addEventListener("selectionchange", () => {
  const text = getSelectionText();
  if (text.length > 0) positionFab();
  else if (fab) fab.style.display = "none";
});
document.addEventListener("keydown", (ev) => {
  if (ev.altKey && (ev.key.toLowerCase() === "s")) {
    const text = getSelectionText();
    if (text) { ev.preventDefault(); openSaveModal(text); }
  }
  if (ev.altKey && (ev.key.toLowerCase() === "n")) {
    ev.preventDefault(); togglePanel();
  }
});
function openSaveModalFromSelection() {
  const text = getSelectionText();
  if (!text) return; openSaveModal(text);
}
function openSaveModal(content: string) {
  const backdrop = document.createElement("div");
  backdrop.className = "foras-modal-backdrop";
  const modal = document.createElement("div");
  modal.className = "foras-modal";
  modal.innerHTML = `
    <h3>Guardar en FORAS</h3>
    <div class="foras-field">
      <label>Título</label>
      <input type="text" id="foras-title" placeholder="Ej. Prompt de depuración">
    </div>
    <div class="foras-field">
      <label>Contenido</label>
      <textarea id="foras-content" rows="6"></textarea>
    </div>
    <div class="foras-field">
      <label>Tags (coma-separadas)</label>
      <input type="text" id="foras-tags" placeholder="marketing, debug">
    </div>
    <div class="foras-actions">
      <button class="foras-btn" id="foras-cancel">Cancelar</button>
      <button class="foras-btn primary" id="foras-save">Guardar</button>
    </div>
  `;
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  (modal.querySelector("#foras-content") as HTMLTextAreaElement).value = content;
  (modal.querySelector("#foras-title") as HTMLInputElement).value = content.slice(0, 60);
  function close() { backdrop.remove(); }
  modal.querySelector("#foras-cancel")?.addEventListener("click", close);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
  modal.querySelector("#foras-save")?.addEventListener("click", async () => {
    const title = (modal.querySelector("#foras-title") as HTMLInputElement).value.trim() || "Nota sin título";
    const contentVal = (modal.querySelector("#foras-content") as HTMLTextAreaElement).value.trim();
    const tagsStr = (modal.querySelector("#foras-tags") as HTMLInputElement).value.trim();
    const tags = tagsStr ? tagsStr.split(",").map(t => t.trim()).filter(Boolean) : [];
    const note: Note = {
      id: crypto.randomUUID(),
      title, content: contentVal, tags, aliases: [], starred: false,
      createdAt: Date.now(), updatedAt: Date.now()
    };
    await update<Note[]>(NOTES_KEY, (curr) => {
      const list = curr ?? []; return [note, ...list];
    });
    close(); ensurePanelRendered(); await renderPanel();
  });
}
async function getNotes(): Promise<Note[]> {
  const n = await getItem<Note[]>(NOTES_KEY); return n ?? [];
}
function ensurePanelRendered() {
  if (panelEl && document.body.contains(panelEl)) return;
  panelEl = document.createElement("div");
  panelEl.className = "foras-panel"; panelEl.style.display = "none";
  panelEl.innerHTML = `
    <h3>FORAS — Notas</h3>
    <div class="foras-field">
      <input id="foras-search" type="text" placeholder="Buscar...">
    </div>
    <div id="foras-list"></div>`;
  document.body.appendChild(panelEl);
  const input = panelEl.querySelector("#foras-search") as HTMLInputElement;
  input?.addEventListener("input", () => renderPanel(input.value.trim().toLowerCase()));
}
function togglePanel() { ensurePanelRendered(); if (!panelEl) return;
  panelEl.style.display = panelEl.style.display === "none" ? "block" : "none";
  if (panelEl.style.display === "block") renderPanel(); }
function findChatGPTInput(): HTMLTextAreaElement | HTMLDivElement | null {
  const textarea = document.querySelector("textarea"); if (textarea) return textarea as HTMLTextAreaElement;
  const ced = document.querySelector("div[contenteditable='true']"); return ced as HTMLDivElement | null;
}
function insertTextAtCursor(el: HTMLTextAreaElement | HTMLDivElement, text: string) {
  if (el instanceof HTMLTextAreaElement) {
    const start = el.selectionStart || 0; const end = el.selectionEnd || 0;
    const value = el.value; el.value = value.slice(0, start) + text + value.slice(end);
    el.selectionStart = el.selectionEnd = start + text.length;
    el.dispatchEvent(new Event("input", { bubbles: true } as any)); el.focus();
  } else {
    el.focus(); const sel = window.getSelection(); if (!sel) return;
    const range = sel.getRangeAt(0); range.deleteContents();
    range.insertNode(document.createTextNode(text));
  }
}
async function renderPanel(query: string = "") {
  if (!panelEl) return;
  const listEl = panelEl.querySelector("#foras-list") as HTMLDivElement;
  listEl.innerHTML = ""; const notes = await getNotes();
  const filtered = query
    ? notes.filter(n => (n.title + " " + n.content + " " + (n.tags||[]).join(" ")).toLowerCase().includes(query))
    : notes;
  for (const n of filtered) {
    const item = document.createElement("div");
    item.className = "foras-note";
    item.innerHTML = `<strong>${n.title}</strong><div style="opacity:.7;font-size:12px;margin-top:4px">${(n.tags||[]).join(", ")}</div>`;
    item.addEventListener("click", () => {
      const input = findChatGPTInput(); if (input) insertTextAtCursor(input, n.content);
    });
    listEl.appendChild(item);
  }
}
ensurePanelRendered();
