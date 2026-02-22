(function () {
  const DATASETS = [
    {
      id: "lessons_archive",
      title: "Lessons Archive",
      file: "data/lessons_archive.json",
      rootKey: "lessons",
      idKey: "id",
      titleKey: "title",
      subtitleKeys: ["playlist", "videoId"],
      template: {
        id: "",
        playlist: "",
        title: "",
        videoId: "",
        pdfLink: "",
        thumbnail: "",
        status: "ON"
      }
    },
    {
      id: "lessons_live",
      title: "Lessons Live",
      file: "data/lessons_live.json",
      rootKey: "lessons",
      idKey: "id",
      titleKey: "title",
      subtitleKeys: ["playlist", "videoId"],
      template: {
        id: "",
        playlist: "",
        title: "",
        videoId: "",
        pdfLink: "",
        thumbnail: "",
        status: "ON"
      }
    },
    {
      id: "quiz",
      title: "Quiz",
      file: "data/quiz.json",
      rootKey: "quiz",
      idKey: "question",
      titleKey: "question",
      subtitleKeys: ["date", "answer"],
      template: {
        question: "",
        options: ["", "", "", ""],
        answer: "A",
        explanation: "",
        date: ""
      }
    },
    {
      id: "updates",
      title: "Updates",
      file: "data/updates.json",
      rootKey: null,
      idKey: "title",
      titleKey: "title",
      subtitleKeys: ["date", "status", "batch"],
      template: {
        status: "ON",
        batch: "ALL",
        date: "",
        title: "",
        message: "",
        link: "",
        expiry: ""
      }
    },
    {
      id: "welcome",
      title: "Welcome Messages",
      file: "data/welcome.json",
      rootKey: null,
      idKey: "Date",
      titleKey: "Message",
      subtitleKeys: ["Date"],
      template: {
        Date: "",
        Message: ""
      }
    },
    {
      id: "app_urls",
      title: "App URLs",
      file: "data/app_urls.json",
      rootKey: "resources",
      idKey: "app_name",
      titleKey: "app_name",
      subtitleKeys: ["date", "app_url"],
      template: {
        date: "",
        app_name: "",
        app_url: "",
        user_guide: ""
      }
    }
  ];

  const state = {
    currentDatasetId: DATASETS[0].id,
    selectedIndex: -1,
    search: "",
    dirty: false,
    raws: {},
    rows: {},
    filteredIndexes: [],
    importDraft: null
  };

  const els = {};

  function qs(id) {
    return document.getElementById(id);
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function getDataset(datasetId) {
    return DATASETS.find((x) => x.id === (datasetId || state.currentDatasetId));
  }

  function setStatus(text, isError) {
    els.statusLine.textContent = text || "";
    els.statusLine.classList.toggle("error", !!isError);
  }

  function markDirty(next) {
    state.dirty = !!next;
    els.dirtyTag.style.display = state.dirty ? "inline-block" : "none";
  }

  function extractRows(raw, dataset) {
    if (!dataset.rootKey) return Array.isArray(raw) ? deepClone(raw) : [];
    if (raw && typeof raw === "object" && Array.isArray(raw[dataset.rootKey])) {
      return deepClone(raw[dataset.rootKey]);
    }
    return [];
  }

  function withRows(raw, dataset, rows) {
    if (!dataset.rootKey) return deepClone(rows);
    const out = raw && typeof raw === "object" ? deepClone(raw) : {};
    out[dataset.rootKey] = deepClone(rows);
    return out;
  }

  function rowIdentity(row, index, dataset) {
    if (dataset.idKey && row && row[dataset.idKey]) return String(row[dataset.idKey]);
    return `row-${index + 1}`;
  }

  function rowTitle(row, index, dataset) {
    const key = dataset.titleKey;
    if (key && row && row[key]) return String(row[key]);
    return rowIdentity(row, index, dataset);
  }

  function rowSub(row, dataset) {
    const parts = [];
    (dataset.subtitleKeys || []).forEach((k) => {
      if (row && row[k]) parts.push(String(row[k]));
    });
    if (!parts.length) return "";
    return parts.join(" | ");
  }

  function getCurrentDataset() {
    return getDataset(state.currentDatasetId);
  }

  function getCurrentRows() {
    return state.rows[state.currentDatasetId] || [];
  }

  function updateDatasetMetaUI() {
    const dataset = getCurrentDataset();
    els.datasetTitle.textContent = dataset.title;
    els.datasetPath.textContent = dataset.file;
    document.querySelectorAll(".dataset-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.datasetId === dataset.id);
    });
  }

  function renderDatasetMenu() {
    els.datasetMenu.innerHTML = "";
    DATASETS.forEach((dataset) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "dataset-btn";
      btn.dataset.datasetId = dataset.id;
      btn.textContent = dataset.title;
      btn.addEventListener("click", () => {
        if (state.currentDatasetId === dataset.id) return;
        state.currentDatasetId = dataset.id;
        state.selectedIndex = -1;
        state.search = "";
        els.searchInput.value = "";
        clearRowEditor();
        renderCurrentDataset();
      });
      els.datasetMenu.appendChild(btn);
    });
    updateDatasetMetaUI();
  }

  function clearRowEditor() {
    els.selectedKey.textContent = "none";
    els.rowJsonEditor.value = "";
    if (els.rowForm) els.rowForm.innerHTML = "";
    els.rowError.style.display = "none";
    els.rowError.textContent = "";
  }

  function renderRowsList() {
    const dataset = getCurrentDataset();
    const rows = getCurrentRows();
    const query = state.search.trim().toLowerCase();
    const indexes = [];

    rows.forEach((row, i) => {
      if (!query) {
        indexes.push(i);
        return;
      }
      const hay = JSON.stringify(row || {}).toLowerCase();
      if (hay.includes(query)) indexes.push(i);
    });

    state.filteredIndexes = indexes;
    els.rowList.innerHTML = "";
    els.rowsCount.textContent = String(rows.length);

    if (!indexes.length) {
      const empty = document.createElement("div");
      empty.className = "row-item";
      empty.innerHTML = '<div class="row-item-title">No rows</div><div class="row-item-sub">Try different search or add a row.</div>';
      els.rowList.appendChild(empty);
      return;
    }

    indexes.forEach((rowIndex) => {
      const row = rows[rowIndex];
      const div = document.createElement("div");
      div.className = "row-item";
      if (state.selectedIndex === rowIndex) div.classList.add("active");
      div.innerHTML =
        `<div class="row-item-title">${escapeHtml(rowTitle(row, rowIndex, dataset))}</div>` +
        `<div class="row-item-sub">${escapeHtml(rowSub(row, dataset) || rowIdentity(row, rowIndex, dataset))}</div>`;
      div.addEventListener("click", () => selectRow(rowIndex));
      els.rowList.appendChild(div);
    });
  }

  function selectRow(index) {
    const dataset = getCurrentDataset();
    const rows = getCurrentRows();
    const row = rows[index];
    state.selectedIndex = typeof row === "undefined" ? -1 : index;
    if (state.selectedIndex < 0) {
      clearRowEditor();
      renderRowsList();
      return;
    }
    els.selectedKey.textContent = rowIdentity(row, index, dataset);
    // populate form fields
    renderRowForm(row);
    // keep JSON textarea in sync (hidden) for fallback
    els.rowJsonEditor.value = JSON.stringify(row, null, 2);
    els.rowError.style.display = "none";
    els.rowError.textContent = "";
    renderRowsList();
  }

  function renderCurrentDataset() {
    updateDatasetMetaUI();
    renderRowsList();
    if (state.selectedIndex >= 0) {
      selectRow(state.selectedIndex);
    } else {
      clearRowEditor();
    }
    resetImportUi();
  }

  function createRowFromTemplate() {
    const dataset = getCurrentDataset();
    const row = deepClone(dataset.template || {});
    if (dataset.id === "lessons_archive" || dataset.id === "lessons_live") {
      row.id = `${Date.now()}`;
    }
    return row;
  }

  function addRow() {
    const rows = getCurrentRows();
    rows.push(createRowFromTemplate());
    state.selectedIndex = rows.length - 1;
    markDirty(true);
    renderCurrentDataset();
    setStatus("Added a new row.", false);
  }

  function cloneRow() {
    const rows = getCurrentRows();
    if (state.selectedIndex < 0 || !rows[state.selectedIndex]) {
      setStatus("Select a row to duplicate.", true);
      return;
    }
    const clone = deepClone(rows[state.selectedIndex]);
    if (clone.id) clone.id = `${clone.id}_copy_${Date.now()}`;
    rows.splice(state.selectedIndex + 1, 0, clone);
    state.selectedIndex += 1;
    markDirty(true);
    renderCurrentDataset();
    setStatus("Duplicated selected row.", false);
  }

  function deleteRow() {
    const rows = getCurrentRows();
    if (state.selectedIndex < 0 || !rows[state.selectedIndex]) {
      setStatus("Select a row to delete.", true);
      return;
    }
    const ok = window.confirm("Delete selected row?");
    if (!ok) return;
    rows.splice(state.selectedIndex, 1);
    state.selectedIndex = Math.min(state.selectedIndex, rows.length - 1);
    markDirty(true);
    renderCurrentDataset();
    setStatus("Deleted selected row.", false);
  }

  function saveRow() {
    const rows = getCurrentRows();
    if (state.selectedIndex < 0 || !rows[state.selectedIndex]) {
      setStatus("Select a row first.", true);
      return;
    }

    let parsed;
    // if form inputs exist, build object from them
    if (els.rowForm && els.rowForm.children.length) {
      parsed = collectFormValues();
    } else {
      try {
        parsed = JSON.parse(els.rowJsonEditor.value || "{}");
      } catch (err) {
        els.rowError.style.display = "block";
        els.rowError.textContent = `Invalid JSON: ${err.message}`;
        setStatus("Row JSON is invalid.", true);
        return;
      }
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      els.rowError.style.display = "block";
      els.rowError.textContent = "Row must be a JSON object.";
      setStatus("Row JSON must be object.", true);
      return;
    }

    els.rowError.style.display = "none";
    rows[state.selectedIndex] = parsed;
    markDirty(true);
    renderCurrentDataset();
    setStatus("Row saved to draft.", false);
  }

  function escapeHtml(text) {
    if (text == null) return "";
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // build editable form fields for a row object
  function renderRowForm(row) {
    if (!els.rowForm) return;
    els.rowForm.innerHTML = "";
    if (!row || typeof row !== 'object' || Array.isArray(row)) return;
    Object.keys(row).forEach((k) => {
      const val = row[k];
      const field = document.createElement('div');
      field.className = 'admin-field';
      const label = document.createElement('label');
      label.textContent = k;
      let input;
      if (val !== null && typeof val === 'object') {
        input = document.createElement('textarea');
        input.rows = 3;
        input.value = JSON.stringify(val);
      } else {
        input = document.createElement('input');
        input.type = 'text';
        input.value = val == null ? '' : String(val);
      }
      input.name = k;
      field.appendChild(label);
      field.appendChild(input);
      els.rowForm.appendChild(field);
    });
  }

  // extract values from the form inputs, parse JSON for complex entries
  function collectFormValues() {
    const obj = {};
    if (!els.rowForm) return obj;
    const inputs = els.rowForm.querySelectorAll('input[name],textarea[name]');
    inputs.forEach((inp) => {
      const key = inp.name;
      let v = inp.value;
      try {
        const maybe = JSON.parse(v);
        v = maybe;
      } catch {
        // treat as string
      }
      obj[key] = v;
    });
    return obj;
  }

  function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 200);
  }

  function downloadCsv(filename, csv) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 200);
  }

  function toCsvCell(val) {
    if (val == null) return '';
    const s = String(val);
    if (/[",\r\n]/.test(s)) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function rowsToCsv(rows) {
    if (!Array.isArray(rows) || !rows.length) return '';
    // collect all keys in order of first appearance
    const keys = [];
    rows.forEach(r => {
      if (r && typeof r === 'object' && !Array.isArray(r)) {
        Object.keys(r).forEach(k => {
          if (!keys.includes(k)) keys.push(k);
        });
      }
    });
    const lines = [];
    lines.push(keys.map(toCsvCell).join(','));
    rows.forEach(r => {
      const line = keys.map(k => toCsvCell(r[k])).join(',');
      lines.push(line);
    });
    return lines.join('\r\n');
  }

  function exportCurrentCsv() {
    const dataset = getCurrentDataset();
    const rows = getCurrentRows();
    const csv = rowsToCsv(rows);
    if (!csv) {
      setStatus('No data to export.', true);
      return;
    }
    const filename = dataset.file.split('/').pop().replace(/\.json$/, '.csv');
    downloadCsv(filename, csv);
    markDirty(false);
    setStatus(`Exported ${filename}.`, false);
  }

  async function exportAllCsv() {
    if (typeof window.JSZip === 'undefined') {
      setStatus('ZIP library unavailable. Refresh and retry.', true);
      return;
    }
    const zip = new window.JSZip();
    DATASETS.forEach(dataset => {
      const rows = state.rows[dataset.id] || [];
      const csv = rowsToCsv(rows);
      const fname = dataset.file.split('/').pop().replace(/\.json$/, '.csv');
      zip.file(fname, csv);
    });
    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `data-admin-csv-${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 200);
    markDirty(false);
    setStatus('Exported CSV ZIP for all datasets.', false);
  }

  function exportedRawForDataset(dataset) {
    return withRows(state.raws[dataset.id], dataset, state.rows[dataset.id] || []);
  }

  // try to associate a workbook sheet name and data with one of our datasets
  function matchDatasetForSheet(sheetName, sheetData) {
    if (!sheetName) return null;
    const name = String(sheetName).trim();
    if (!name) return null;
    const lower = name.toLowerCase();
    
    // try exact matches first: id, filename base, normalized
    let candidates = [];
    
    // exact id match
    let ds = DATASETS.find(d => d.id.toLowerCase() === lower);
    if (ds) candidates.push(ds);
    
    // exact filename base match
    if (!ds) {
      ds = DATASETS.find(d => d.file.split('/').pop().replace(/\.json$/i, '').toLowerCase() === lower);
      if (ds) candidates.push(ds);
    }
    
    // normalized (spaces/dashes -> underscores)
    const norm = lower.replace(/[\s\-]+/g, '_');
    if (candidates.length === 0) {
      ds = DATASETS.find(d => 
        d.id.toLowerCase() === norm || 
        d.file.split('/').pop().replace(/\.json$/i, '').toLowerCase() === norm
      );
      if (ds) candidates.push(ds);
    }
    
    // title match (lower priority)
    if (candidates.length === 0) {
      ds = DATASETS.find(d => d.title.toLowerCase() === lower);
      if (ds) candidates.push(ds);
    }
    
    if (candidates.length === 0) return null;
    
    // if we have candidates, try to validate structure if data is provided
    if (sheetData && Array.isArray(sheetData)) {
      for (const candidate of candidates) {
        try {
          detectRowsFromImport(candidate, sheetData);
          return candidate; // structure matches
        } catch (err) {
          // structure mismatch, try next candidate
        }
      }
    }
    
    // no data validation or no matches with validation - return first candidate
    return candidates[0];
  }

  function exportCurrent() {
    const dataset = getCurrentDataset();
    const data = exportedRawForDataset(dataset);
    const filename = dataset.file.split("/").pop();
    downloadJson(filename, data);
    markDirty(false);
    setStatus(`Exported ${filename}.`, false);
  }

  async function exportAllZip() {
    if (typeof window.JSZip === "undefined") {
      setStatus("ZIP library unavailable. Refresh and retry.", true);
      return;
    }
    const zip = new window.JSZip();
    DATASETS.forEach((dataset) => {
      const filename = dataset.file.split("/").pop();
      zip.file(filename, JSON.stringify(exportedRawForDataset(dataset), null, 2));
    });
    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `data-admin-export-${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 200);
    markDirty(false);
    setStatus("Exported ZIP for all datasets.", false);
  }

  // export as single XLSX workbook with a sheet per dataset
  async function exportAllWorkbook() {
    if (typeof window.XLSX === 'undefined') {
      setStatus('Spreadsheet library unavailable. Refresh and retry.', true);
      return;
    }
    const wb = window.XLSX.utils.book_new();
    DATASETS.forEach((dataset) => {
      const rows = state.rows[dataset.id] || [];
      // use just rows; user can re-import to update
      const ws = window.XLSX.utils.json_to_sheet(rows);
      const sheetName = dataset.id;
      window.XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });
    const wbout = window.XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
    function s2ab(s) {
      const buf = new ArrayBuffer(s.length);
      const view = new Uint8Array(buf);
      for (let i = 0; i < s.length; ++i) view[i] = s.charCodeAt(i) & 0xff;
      return buf;
    }
    const blob = new Blob([s2ab(wbout)], { type: 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `data-${Date.now()}.xlsx`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 200);
    markDirty(false);
    setStatus('Exported workbook for all datasets.', false);
  }

  function rowKey(dataset, row, index) {
    if (dataset.idKey && row && row[dataset.idKey]) return `k:${String(row[dataset.idKey]).trim()}`;
    return `i:${index}:${JSON.stringify(row)}`;
  }

  function previewImportRows(dataset, incomingRows, mode) {
    const existing = getCurrentRows();
    const indexByKey = new Map();
    existing.forEach((row, i) => indexByKey.set(rowKey(dataset, row, i), i));

    let add = 0;
    let update = 0;
    let skip = 0;
    let invalid = 0;

    incomingRows.forEach((row, i) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        invalid += 1;
        return;
      }
      const k = rowKey(dataset, row, i);
      const exists = indexByKey.has(k);
      if (mode === "replace") {
        return;
      }
      if (exists) {
        if (mode === "skip") skip += 1;
        else update += 1;
      } else {
        add += 1;
      }
    });

    if (mode === "replace") {
      return {
        add: incomingRows.length,
        update: 0,
        skip: 0,
        invalid: 0,
        text: `Mode: replace\nIncoming: ${incomingRows.length}\nCurrent rows will be replaced entirely.`
      };
    }

    return {
      add,
      update,
      skip,
      invalid,
      text: `Mode: ${mode}\nIncoming: ${incomingRows.length}\nAdd: ${add}\nUpdate: ${update}\nSkip: ${skip}\nInvalid: ${invalid}`
    };
  }

  function applyImportRows(dataset, incomingRows, mode) {
    if (mode === "replace") {
      state.rows[dataset.id] = deepClone(incomingRows);
      state.selectedIndex = incomingRows.length ? 0 : -1;
      return { add: incomingRows.length, update: 0, skip: 0, invalid: 0 };
    }

    const rows = getCurrentRows();
    const indexByKey = new Map();
    rows.forEach((row, i) => indexByKey.set(rowKey(dataset, row, i), i));

    let add = 0;
    let update = 0;
    let skip = 0;
    let invalid = 0;

    incomingRows.forEach((row, i) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        invalid += 1;
        return;
      }
      const k = rowKey(dataset, row, i);
      const existingIndex = indexByKey.get(k);
      if (typeof existingIndex === "number") {
        if (mode === "skip") {
          skip += 1;
          return;
        }
        rows[existingIndex] = deepClone(row);
        update += 1;
      } else {
        rows.push(deepClone(row));
        indexByKey.set(k, rows.length - 1);
        add += 1;
      }
    });

    return { add, update, skip, invalid };
  }

  function detectRowsFromImport(dataset, parsed) {
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object") {
      if (dataset.rootKey && Array.isArray(parsed[dataset.rootKey])) return parsed[dataset.rootKey];
      if (dataset.rootKey && !Array.isArray(parsed[dataset.rootKey]) && Array.isArray(parsed)) return parsed;
      if (!dataset.rootKey && Array.isArray(parsed)) return parsed;
    }
    throw new Error(`Invalid shape for ${dataset.title}.`);
  }

  // guess which dataset a parsed JSON/CSV belongs to by filename first, then structure
  function guessDatasetFromImport(parsed, filename) {
    if (!parsed || typeof parsed !== 'object') return null;
    filename = String(filename || '').toLowerCase();
    
    // first: try matching by filename
    if (filename) {
      // exact match on dataset id or filename base
      for (const ds of DATASETS) {
        const dsBase = ds.file.split('/').pop().replace(/\.json$/i, '').toLowerCase();
        if (filename.includes(ds.id) || filename.includes(dsBase)) {
          // verify the structure at least partially matches
          try {
            detectRowsFromImport(ds, parsed);
            return ds; // structure matches, use this dataset
          } catch {
            // structure mismatch, continue searching
          }
        }
      }
    }
    
    // fallback: try with rootKey
    for (const ds of DATASETS) {
      if (ds.rootKey && Array.isArray(parsed[ds.rootKey])) {
        return ds;
      }
    }
    
    // fallback: if array at root, check for specific field patterns
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) return null;
      const first = parsed[0];
      if (!first || typeof first !== 'object') return null;
      
      // check for quiz structure
      if ('question' in first && 'options' in first && 'answer' in first) {
        return DATASETS.find(d => d.id === 'quiz');
      }
      // check for lessons structure - prioritize based on filename
      if ('id' in first && 'playlist' in first && 'videoId' in first) {
        if (filename.includes('live')) return DATASETS.find(d => d.id === 'lessons_live');
        if (filename.includes('archive')) return DATASETS.find(d => d.id === 'lessons_archive');
        // default to lessons_archive
        return DATASETS.find(d => d.id === 'lessons_archive') || DATASETS.find(d => d.id === 'lessons_live');
      }
      // check for updates structure
      if ('title' in first && 'message' in first && 'batch' in first) {
        return DATASETS.find(d => d.id === 'updates');
      }
      // check for welcome structure
      if ('Date' in first && 'Message' in first && Object.keys(first).length <= 2) {
        return DATASETS.find(d => d.id === 'welcome');
      }
      // check for app_urls structure
      if ('app_name' in first && 'app_url' in first) {
        return DATASETS.find(d => d.id === 'app_urls');
      }
    }
    
    return null;
  }

  function resetImportUi() {
    state.importDraft = null;
    els.importFile.value = "";
    els.importSummary.textContent = "Upload a JSON, CSV or XLSX file and preview impact before applying.";
    els.importPreviewBox.textContent = "";
  }

  function parseImportText(text) {
    const trimmed = String(text || "").trim();
    if (!trimmed) throw new Error("Import file is empty.");
    return JSON.parse(trimmed);
  }

  // handle files of various formats (json, csv, xlsx)
  // check if a field name is likely a date field
  function isDateField(fieldName) {
    const name = String(fieldName || '').toLowerCase();
    return /date|expiry|birth/.test(name);
  }

  // convert Excel serial date to ISO date string (YYYY-MM-DD)
  function excelDateToIsoString(excelSerialDate) {
    if (typeof excelSerialDate !== 'number') return null;
    // Excel epoch is Dec 30, 1899. Jan 1, 1970 is 25569 in Excel.
    const jsDate = new Date((excelSerialDate - 25569) * 86400 * 1000);
    // return YYYY-MM-DD format
    const year = jsDate.getUTCFullYear();
    const month = String(jsDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(jsDate.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // recursively convert Excel serial dates in rows to proper date strings
  function convertExcelDatesToStrings(rows) {
    if (!Array.isArray(rows)) return rows;
    return rows.map(row => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) return row;
      const converted = {};
      Object.keys(row).forEach(key => {
        const val = row[key];
        // if field is a date field and value is a number that looks like an Excel date
        if (isDateField(key) && typeof val === 'number' && val > 0 && val < 100000) {
          converted[key] = excelDateToIsoString(val);
        } else {
          converted[key] = val;
        }
      });
      return converted;
    });
  }

  async function parseImportFile(file) {
    const name = (file.name || '').toLowerCase();
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      if (typeof window.XLSX === 'undefined') {
        throw new Error('Spreadsheet library unavailable.');
      }
      const buf = await file.arrayBuffer();
      const wb = window.XLSX.read(buf, { type: 'array' });
      const sheets = {};
      wb.SheetNames.forEach((sheetName) => {
        const ws = wb.Sheets[sheetName];
        // defval ensures empty cells become empty strings
        const rawRows = window.XLSX.utils.sheet_to_json(ws, { defval: '' });
        // convert Excel serial dates to date strings
        sheets[sheetName] = convertExcelDatesToStrings(rawRows);
      });
      return { kind: 'workbook', filename: file.name, sheets };
    }

    const text = await file.text();
    if (name.endsWith('.csv')) {
      if (typeof window.XLSX !== 'undefined') {
        const wb = window.XLSX.read(text, { type: 'string' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows = window.XLSX.utils.sheet_to_json(ws, { defval: '' });
        const rows = convertExcelDatesToStrings(rawRows);
        return { kind: 'single', filename: file.name, rows, sourceType: 'csv' };
      }
      // fallback: split by lines/comma
      const lines = text.split(/\r?\n/).filter(Boolean);
      const headers = lines[0].split(',');
      const rows = lines.slice(1).map((l) => {
        const vals = l.split(',');
        const obj = {};
        headers.forEach((h, i) => (obj[h.trim()] = vals[i] ? vals[i].trim() : ''));
        return obj;
      });
      return { kind: 'single', filename: file.name, rows, sourceType: 'csv' };
    }

    // assume json
    const parsed = parseImportText(text);
    return { kind: 'single', filename: file.name, rows: parsed };
  }


  function runValidation() {
    const list = [];
    DATASETS.forEach((dataset) => {
      const rows = state.rows[dataset.id] || [];
      const seen = new Set();
      rows.forEach((row, i) => {
        const rowRef = `${dataset.title} row ${i + 1}`;
        if (!row || typeof row !== "object" || Array.isArray(row)) {
          list.push(`${rowRef}: not a JSON object.`);
          return;
        }
        if (dataset.idKey && row[dataset.idKey]) {
          const id = String(row[dataset.idKey]).trim();
          const k = `${dataset.id}:${id}`;
          if (seen.has(k)) list.push(`${rowRef}: duplicate ${dataset.idKey} "${id}".`);
          seen.add(k);
        }
        if ("status" in row) {
          const sv = String(row.status || "").toUpperCase();
          if (sv && sv !== "ON" && sv !== "OFF") {
            list.push(`${rowRef}: status should be ON or OFF.`);
          }
        }
        if (dataset.id === "quiz") {
          if (!Array.isArray(row.options) || row.options.length < 2) {
            list.push(`${rowRef}: options should be an array with at least 2 choices.`);
          }
          const ans = String(row.answer || "").toUpperCase();
          if (!["A", "B", "C", "D"].includes(ans)) {
            list.push(`${rowRef}: answer should be A/B/C/D.`);
          }
        }
        if (dataset.id.startsWith("lessons_")) {
          if (!row.playlist || !row.title || !row.videoId) {
            list.push(`${rowRef}: playlist, title and videoId are required.`);
          }
        }
      });
    });

    els.validationList.innerHTML = "";
    if (!list.length) {
      setStatus("Validation passed. No issues found.", false);
      return;
    }
    list.forEach((msg) => {
      const div = document.createElement("div");
      div.className = "validation-item";
      div.textContent = msg;
      els.validationList.appendChild(div);
    });
    setStatus(`Validation found ${list.length} issue(s).`, true);
  }

  function resolveDataPath(path) {
    if (/^https?:\/\//i.test(path)) return path;
    return '../' + path;
  }

  async function loadConfig() {
    try {
      const res = await fetch('../config.json');
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Failed to load config.json', e);
    }
    return null;
  }

  async function loadAll() {
    const jobs = DATASETS.map(async (dataset) => {
      const url = resolveDataPath(dataset.file);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to load ${dataset.file}`);
      const raw = await res.json();
      state.raws[dataset.id] = deepClone(raw);
      state.rows[dataset.id] = extractRows(raw, dataset);
    });
    await Promise.all(jobs);
  }

  function cacheEls() {
    els.datasetMenu = qs("datasetMenu");
    els.datasetTitle = qs("datasetTitle");
    els.datasetPath = qs("datasetPath");
    els.dirtyTag = qs("dirtyTag");
    els.searchInput = qs("searchInput");
    els.addRowBtn = qs("addRowBtn");
    els.cloneRowBtn = qs("cloneRowBtn");
    els.deleteRowBtn = qs("deleteRowBtn");
    els.saveRowBtn = qs("saveRowBtn");
    els.rowList = qs("rowList");
    els.rowsCount = qs("rowsCount");
    els.selectedKey = qs("selectedKey");
    els.rowJsonEditor = qs("rowJsonEditor");
    els.rowForm = qs("rowForm");
    els.rowFormLabel = qs("rowFormLabel");
    els.rowError = qs("rowError");
    els.importFile = qs("importFile");
    els.importMode = qs("importMode");
    els.previewImportBtn = qs("previewImportBtn");
    els.applyImportBtn = qs("applyImportBtn");
    els.clearImportBtn = qs("clearImportBtn");
    els.importSummary = qs("importSummary");
    els.importPreviewBox = qs("importPreviewBox");
    els.exportCurrentBtn = qs("exportCurrentBtn");
    els.exportAllBtn = qs("exportAllBtn");
    els.exportCurrentCsvBtn = qs("exportCurrentCsvBtn");
    els.exportAllCsvBtn = qs("exportAllCsvBtn");
    els.reloadAllBtn = qs("reloadAllBtn");
    els.validateBtn = qs("validateBtn");
    els.discardBtn = qs("discardBtn");
    els.statusLine = qs("statusLine");
    els.validationList = qs("validationList");
  }

  function bindEvents() {
    els.searchInput.addEventListener("input", () => {
      state.search = els.searchInput.value || "";
      renderRowsList();
    });

    els.addRowBtn.addEventListener("click", addRow);
    els.cloneRowBtn.addEventListener("click", cloneRow);
    els.deleteRowBtn.addEventListener("click", deleteRow);
    els.saveRowBtn.addEventListener("click", saveRow);
    els.exportCurrentBtn.addEventListener("click", exportCurrent);
    els.exportCurrentCsvBtn?.addEventListener('click', exportCurrentCsv);
    els.exportAllBtn.addEventListener("click", exportAllZip);
    els.exportAllCsvBtn?.addEventListener('click', exportAllCsv);
    // new workbook export
    els.exportAllXlsxBtn = qs('exportAllXlsxBtn');
    if (els.exportAllXlsxBtn) {
      els.exportAllXlsxBtn.addEventListener('click', exportAllWorkbook);
    }

    els.reloadAllBtn.addEventListener("click", async () => {
      if (state.dirty) {
        const ok = window.confirm("Discard unsaved draft changes and reload from source files?");
        if (!ok) return;
      }
      await loadAll();
      state.selectedIndex = -1;
      markDirty(false);
      renderCurrentDataset();
      setStatus("Reloaded all datasets from source JSON files.", false);
    });

    els.importFile.addEventListener("change", async (e) => {
      const file = (e.target.files || [])[0];
      if (!file) {
        state.importDraft = null;
        return;
      }
      try {
        const result = await parseImportFile(file);
        if (result.kind === 'workbook') {
          // store entire workbook sheets
          state.importDraft = result;
          els.importSummary.textContent = `Loaded workbook ${file.name}. Sheets: ${Object.keys(result.sheets).join(', ')}.`;
          els.importPreviewBox.textContent = "";
        } else {
          // single dataset scenario: guess which dataset this is for
          const guessedDataset = guessDatasetFromImport(result.rows, file.name);
          if (!guessedDataset) {
            state.importDraft = null;
            els.importSummary.textContent = `Could not detect dataset type from file.`;
            els.importPreviewBox.textContent = "";
            setStatus("Could not automatically detect which dataset this file belongs to.", true);
            return;
          }
          
          // check if guessed dataset matches currently selected
          const currentDataset = getCurrentDataset();
          if (guessedDataset.id !== currentDataset.id) {
            // auto-switch to the detected dataset
            state.currentDatasetId = guessedDataset.id;
            state.selectedIndex = -1;
            state.search = "";
            els.searchInput.value = "";
            clearRowEditor();
            // render the new dataset
            updateDatasetMetaUI();
            renderRowsList();
            clearRowEditor();
            resetImportUi();
          }
          
          const dataset = getDataset(guessedDataset.id);
          const rows = detectRowsFromImport(dataset, result.rows);
          state.importDraft = { filename: file.name, rows, sourceType: result.sourceType, datasetId: dataset.id };
          els.importSummary.textContent = `Loaded ${file.name} (${dataset.title}). Rows detected: ${rows.length}.`;
          els.importPreviewBox.textContent = "";
          setStatus(`Auto-switched to ${dataset.title} based on file structure.`, false);
        }
      } catch (err) {
        state.importDraft = null;
        els.importSummary.textContent = `Invalid import file: ${err.message}`;
        els.importPreviewBox.textContent = "";
        setStatus(`Import error: ${err.message}`, true);
      }
    });

    els.previewImportBtn.addEventListener("click", () => {
      if (!state.importDraft) {
        setStatus("Select an import file first.", true);
        return;
      }
      const mode = String(els.importMode.value || "merge");

      if (state.importDraft.kind === 'workbook') {
        let summaryText = '';
        const unmatched = [];
        Object.keys(state.importDraft.sheets).forEach((sheet) => {
          const sheetData = state.importDraft.sheets[sheet];
          const ds = matchDatasetForSheet(sheet, sheetData);
          if (!ds) {
            unmatched.push(sheet);
            return;
          }
          const rows = sheetData;
          const preview = previewImportRows(ds, rows, mode);
          summaryText += `${ds.title} (${sheet}): add=${preview.add}, update=${preview.update}, skip=${preview.skip}, invalid=${preview.invalid}\n`;
        });
        if (unmatched.length) {
          summaryText += `\nUnmatched sheets: ${unmatched.join(', ')} (will be ignored)`;
        }
        state.importDraft.preview = { text: summaryText };
        els.importSummary.textContent = `Preview ready for workbook (${mode}).`;
        els.importPreviewBox.textContent = summaryText;
        setStatus("Import preview generated.", false);
      } else {
        const dataset = getCurrentDataset();
        const preview = previewImportRows(dataset, state.importDraft.rows, mode);
        state.importDraft.preview = preview;
        els.importSummary.textContent = `Preview ready for ${dataset.title} (${mode}).`;
        els.importPreviewBox.textContent = preview.text;
        setStatus("Import preview generated.", false);
      }
    });

    els.applyImportBtn.addEventListener("click", () => {
      if (!state.importDraft) {
        setStatus("Select and preview an import file first.", true);
        return;
      }
      const mode = String(els.importMode.value || "merge");
      if (state.importDraft.kind === 'workbook') {
        let summary = '';
        const unmatched = [];
        Object.keys(state.importDraft.sheets).forEach((sheet) => {
          const sheetData = state.importDraft.sheets[sheet];
          const ds = matchDatasetForSheet(sheet, sheetData);
          if (!ds) {
            unmatched.push(sheet);
            return;
          }
          const rows = sheetData;
          const stats = applyImportRows(ds, rows, mode);
          summary += `${ds.title} (${sheet}): add=${stats.add}, update=${stats.update}, skip=${stats.skip}, invalid=${stats.invalid}\n`;
          if (ds.id === state.currentDatasetId) {
            state.selectedIndex = getCurrentRows().length ? 0 : -1;
          }
        });
        if (unmatched.length) {
          summary += `\nIgnored sheets: ${unmatched.join(', ')}`;
        }
        markDirty(true);
        renderCurrentDataset();
        els.importSummary.textContent = summary;
        els.importPreviewBox.textContent = summary;
        setStatus(summary, false);
      } else {
        const targetDatasetId = state.importDraft.datasetId || state.currentDatasetId;
        const dataset = getDataset(targetDatasetId);
        const stats = applyImportRows(dataset, state.importDraft.rows, mode);
        state.selectedIndex = getCurrentRows().length ? 0 : -1;
        markDirty(true);
        renderCurrentDataset();
        const summary = `Applied import to ${dataset.title} (${mode}): add=${stats.add}, update=${stats.update}, skip=${stats.skip}, invalid=${stats.invalid}`;
        els.importSummary.textContent = summary;
        els.importPreviewBox.textContent = summary;
        setStatus(summary, false);
      }
    });

    els.clearImportBtn.addEventListener("click", () => {
      resetImportUi();
      setStatus("Import selection cleared.", false);
    });

    els.validateBtn.addEventListener("click", runValidation);

    els.discardBtn.addEventListener("click", async () => {
      if (!state.dirty) {
        setStatus("No unsaved changes to discard.", false);
        return;
      }
      const ok = window.confirm("Discard unsaved draft changes?");
      if (!ok) return;
      await loadAll();
      state.selectedIndex = -1;
      markDirty(false);
      renderCurrentDataset();
      setStatus("Unsaved changes discarded.", false);
    });
  }

  async function init() {
    cacheEls();
    bindEvents();
    renderDatasetMenu();

    const config = await loadConfig();
    if (config) {
      DATASETS.forEach(ds => {
        if (config[ds.id]) ds.file = config[ds.id];
      });
    }

    try {
      await loadAll();
      renderCurrentDataset();
      setStatus("Admin editor loaded. Edit rows and export JSON files.", false);
    } catch (err) {
      setStatus(`Failed to load datasets: ${err.message}`, true);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
