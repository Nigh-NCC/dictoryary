"use strict";

const el = (id) => document.getElementById(id);

const state = {
  dictionary: [],
  filtered: [],
  selected: [] // array of dictionary entries
};

function normalize(s) {
  return (s || "").toLowerCase().trim();
}

function loadDictionary() {
  return fetch("./dictionary.json")
    .then(r => {
      if (!r.ok) throw new Error("Failed to load dictionary.json");
      return r.json();
    })
    .then(data => {
      // basic validation + normalize shapes
      state.dictionary = (data || []).map(item => ({
        word: String(item.word || "").trim(),
        pos: item.pos || "",
        denotation: item.denotation || "",
        connotation: Array.isArray(item.connotation) ? item.connotation : [],
        formality: Number.isFinite(item.formality) ? item.formality : (item.formality ?? 0),
        intensity: Number.isFinite(item.intensity) ? item.intensity : (item.intensity ?? 0),
        alternatives: item.alternatives || { softer: [], stronger: [] }
      })).filter(x => x.word.length);

      state.filtered = [...state.dictionary].sort((a,b) => a.word.localeCompare(b.word));
      renderAll();
    })
    .catch(err => {
      el("status").textContent = `Error: ${err.message}`;
      console.error(err);
    });
}

function renderWordList() {
  const list = el("wordList");
  list.innerHTML = "";

  state.filtered.forEach(item => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pill";
    btn.textContent = item.word;
    btn.title = `${item.word} • ${item.pos || "word"}`;
    btn.setAttribute('role', 'button');

    // mark if currently selected
    const selected = state.selected.includes(item);
    btn.setAttribute('aria-pressed', selected ? 'true' : 'false');

    btn.addEventListener("click", () => {
      state.selected.push(item);
      renderAll();
    });

    // keyboard: Enter/Space work automatically for buttons; add keyboard shortcut for 'A' to quickly add when focused
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'A' || e.key === 'a') {
        e.preventDefault();
        state.selected.push(item);
        renderAll();
      }
    });

    list.appendChild(btn);
  });

  el("status").textContent = `${state.filtered.length} word(s) shown • ${state.dictionary.length} total`;
}

function renderSentence() {
  const container = el("sentence");
  container.innerHTML = "";

  if (state.selected.length === 0) {
    const ghost = document.createElement("span");
    ghost.className = "tag";
    ghost.textContent = "No words selected yet.";
    container.appendChild(ghost);
    return;
  }

  state.selected.forEach((item, idx) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "pill selected";
    chip.textContent = item.word;
    chip.title = "Click to remove";

    chip.addEventListener("click", () => {
      state.selected.splice(idx, 1);
      renderAll();
    });

    container.appendChild(chip);
  });
}

function renderDetails() {
  const details = el("details");
  details.innerHTML = "";

  if (state.selected.length === 0) {
    details.innerHTML = `<div class="status">Select words to see denotation + connotation.</div>`;
    return;
  }

  state.selected.forEach(item => {
    const card = document.createElement("div");
    card.className = "detail";

    const top = document.createElement("div");
    top.className = "top";

    const word = document.createElement("div");
    word.className = "word";
    word.textContent = item.word;

    const pos = document.createElement("div");
    pos.className = "pos";
    pos.textContent = item.pos || "";

    top.appendChild(word);
    top.appendChild(pos);

    const den = document.createElement("div");
    den.className = "status";
    den.textContent = item.denotation || "";

    const tags = document.createElement("div");
    tags.className = "tags";

    (item.connotation || []).forEach(t => {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = t;
      tags.appendChild(tag);
    });

    // quick stats tags
    const stats = document.createElement("div");
    stats.className = "tags";
    const f = document.createElement("span");
    f.className = "tag";
    f.textContent = `formality: ${item.formality ?? "-"}`;
    const i = document.createElement("span");
    i.className = "tag";
    i.textContent = `intensity: ${item.intensity ?? "-"}`;
    stats.appendChild(f);
    stats.appendChild(i);

    // alternatives
    const alt = document.createElement("div");
    alt.className = "status";
    const softer = (item.alternatives?.softer || []).join(", ");
    const stronger = (item.alternatives?.stronger || []).join(", ");
    alt.textContent = `Softer: ${softer || "—"} • Stronger: ${stronger || "—"}`;

    card.appendChild(top);
    card.appendChild(den);
    card.appendChild(tags);
    card.appendChild(stats);
    card.appendChild(alt);

    details.appendChild(card);
  });
}

function renderSummary() {
  const summary = el("summary");
  summary.innerHTML = "";

  if (state.selected.length === 0) {
    summary.innerHTML = `<div class="status">No summary yet.</div>`;
    return;
  }

  // Build tag counts
  const tagCounts = new Map();
  let formalitySum = 0, intensitySum = 0, n = 0;

  state.selected.forEach(item => {
    n += 1;
    formalitySum += Number(item.formality || 0);
    intensitySum += Number(item.intensity || 0);
    (item.connotation || []).forEach(t => {
      const key = normalize(t);
      tagCounts.set(key, (tagCounts.get(key) || 0) + 1);
    });
  });

  const avgFormality = (formalitySum / n).toFixed(1);
  const avgIntensity = (intensitySum / n).toFixed(1);

  // Top tags
  const topTags = [...tagCounts.entries()]
    .sort((a,b) => b[1] - a[1])
    .slice(0, 8);

  const line1 = document.createElement("div");
  line1.className = "detail";
  line1.innerHTML = `
    <div class="top">
      <div class="word">Overall tone snapshot</div>
      <div class="pos">${n} word(s)</div>
    </div>
    <div class="status">Avg formality: <b>${avgFormality}</b> • Avg intensity: <b>${avgIntensity}</b></div>
  `;

  const tagBox = document.createElement("div");
  tagBox.className = "tags";
  topTags.forEach(([t,count]) => {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = `${t} (${count})`;
    tagBox.appendChild(tag);
  });
  line1.appendChild(tagBox);

  const sentence = document.createElement("div");
  sentence.className = "status";
  sentence.textContent = `Sentence: ${state.selected.map(x => x.word).join(" ")}`;

  summary.appendChild(line1);
  summary.appendChild(sentence);
}

function renderAll() {
  renderWordList();
  renderSentence();
  renderDetails();
  renderSummary();
}

function applySearch(q) {
  const query = normalize(q);
  if (!query) {
    state.filtered = [...state.dictionary].sort((a,b) => a.word.localeCompare(b.word));
  } else {
    state.filtered = state.dictionary
      .filter(x => normalize(x.word).includes(query))
      .sort((a,b) => a.word.localeCompare(b.word));
  }
  renderWordList();
}

function setupUI() {
  el("search").addEventListener("input", (e) => applySearch(e.target.value));

  el("clear").addEventListener("click", () => {
    state.selected = [];
    renderAll();
  });
}

setupUI();
loadDictionary();
