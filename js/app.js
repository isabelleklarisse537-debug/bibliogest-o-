/*
 * Bibliogestão — interface da aplicação.
 * Navegação, importação do banco, exploração da estrutura e renderização
 * das telas alimentadas pelo arquivo SQLite.
 */
(function () {
  "use strict";

  const BG = (window.BG = window.BG || {});
  const utils = BG.utils;

  const SCREEN_META = {
    overview: [
      "Visão Geral",
      "Acompanhe os indicadores do acervo e da circulação da biblioteca"
    ],
    books: [
      "Acervo de Livros",
      "Consulte os títulos, a disponibilidade e o vínculo com empréstimos"
    ],
    readers: [
      "Alunos",
      "Consulte os leitores, as turmas e o histórico de circulação"
    ],
    loans: [
      "Empréstimos",
      "Acompanhe as movimentações e os prazos de devolução"
    ],
    pending: [
      "Pendências",
      "Priorize as devoluções em atraso e inicie a cobrança pelo WhatsApp"
    ],
    librarians: [
      "Bibliotecários",
      "Conheça a equipe responsável pelos registros de empréstimo"
    ],
    reports: [
      "Relatórios",
      "Consolide indicadores para apoiar a gestão do acervo"
    ],
    database: [
      "Base de Dados",
      "Importe o arquivo SQLite e confira o reconhecimento da estrutura"
    ]
  };

  const SENSITIVE_COLUMN = /(senha|password|passwd|chave|token|secret)/i;

  let currentScreen = "overview";
  let currentRawTable = "";
  let toastTimer = null;
  let busy = false;

  function $(selector) {
    return document.querySelector(selector);
  }

  function $all(selector) {
    return Array.from(document.querySelectorAll(selector));
  }

  function state() {
    return BG.database.getState();
  }

  function data() {
    return state().data;
  }

  function hasAnyData() {
    const dataset = data();
    return Boolean(
      dataset.books.length ||
        dataset.readers.length ||
        dataset.loans.length ||
        dataset.librarians.length
    );
  }

  // ============================ NAVEGAÇÃO ============================

  function goToScreen(key) {
    if (!SCREEN_META[key]) return;

    currentScreen = key;

    $all(".screen").forEach(screen => {
      screen.classList.toggle("active", screen.dataset.screen === key);
    });

    $all(".sidebar-menu .nav-item").forEach(item => {
      item.classList.toggle("active", item.dataset.screenTarget === key);
    });

    const meta = SCREEN_META[key];
    const heading = $("#screen-heading");
    const subheading = $("#screen-subheading");
    if (heading) heading.textContent = meta[0];
    if (subheading) subheading.textContent = meta[1];

    if (window.innerWidth < 900) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // ============================ TOAST / STATUS ============================

  function showToast(message, tone) {
    const toast = $("#toast");
    if (!toast) return;

    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className = "toast";
    if (tone === "error") toast.classList.add("is-error");
    if (tone === "success") toast.classList.add("is-success");
    toast.hidden = false;

    toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, 5200);
  }

  function setDbStatus(tone, title, text) {
    const banner = $("#db-status");
    if (!banner) return;

    banner.className = `alert-panel alert-${tone}`;
    const heading = banner.querySelector("h3");
    const paragraph = banner.querySelector("p");
    if (heading) heading.textContent = title;
    if (paragraph) paragraph.textContent = text;
  }

  function formatBytes(bytes) {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const exponent = Math.min(
      Math.floor(Math.log(bytes) / Math.log(1024)),
      units.length - 1
    );
    const value = bytes / Math.pow(1024, exponent);
    return `${new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits: exponent === 0 ? 0 : 1
    }).format(value)} ${units[exponent]}`;
  }

  function displayValue(value) {
    if (value == null) return "";
    if (value instanceof Uint8Array) return "[binário]";
    return String(value);
  }

  function isSensitiveColumn(name) {
    return SENSITIVE_COLUMN.test(utils.normalize(name));
  }

  function maskedValue(columnName, value) {
    if (isSensitiveColumn(columnName) && displayValue(value)) return "••••••";
    return displayValue(value);
  }

  // ============================ IMPORTAÇÃO ============================

  async function handleFile(file) {
    if (!file || busy) return;

    busy = true;
    setDbStatus(
      "info",
      "Importando banco de dados",
      `Lendo ${file.name} e reconhecendo a estrutura das tabelas...`
    );

    try {
      const imported = await BG.database.loadFile(file);
      renderAll();
      goToScreen("database");
      showToast(
        `Banco "${imported.fileName}" importado: ${imported.data.books.length} livros, ${imported.data.readers.length} alunos e ${imported.data.loans.length} empréstimos.`,
        "success"
      );
    } catch (error) {
      console.error("Erro ao importar banco:", error);
      setDbStatus(
        "danger",
        "Não foi possível importar o banco",
        error.message || "Verifique se o arquivo é um SQLite válido."
      );
      showToast(error.message || "Falha ao importar o banco de dados.", "error");
      goToScreen("database");
    } finally {
      busy = false;
      const input = $("#sqlDatabaseUploader");
      if (input) input.value = "";
    }
  }

  async function handleSample() {
    if (busy) return;

    busy = true;
    setDbStatus(
      "info",
      "Carregando banco de exemplo",
      "Buscando o arquivo sisbac_test.db e reconhecendo sua estrutura..."
    );

    try {
      const imported = await BG.database.loadSample();
      renderAll();
      goToScreen("database");
      showToast(
        `Banco de exemplo carregado: ${imported.data.books.length} livros e ${imported.data.loans.length} empréstimos.`,
        "success"
      );
    } catch (error) {
      console.error("Erro ao carregar exemplo:", error);
      setDbStatus(
        "danger",
        "Banco de exemplo indisponível",
        window.location.protocol === "file:"
          ? "O navegador bloqueia a leitura automática de arquivos locais. Use o botão de importação ou abra a aplicação por um servidor local."
          : error.message || "Use o botão de importação para selecionar o arquivo."
      );
      showToast("Não foi possível carregar o banco de exemplo.", "error");
      goToScreen("database");
    } finally {
      busy = false;
    }
  }

  function closeDatabase() {
    BG.database.close();
    currentRawTable = "";
    renderAll();
    setDbStatus(
      "info",
      "Banco de dados fechado",
      "Os dados da sessão foram removidos. Importe outro arquivo para continuar."
    );
    showToast("Banco de dados fechado e dados da sessão limpos.");
  }

  // ============================ RENDERIZAÇÃO GERAL ============================

  function renderAll() {
    renderSidebar();
    renderDatabaseScreen();
    renderOverview();
    renderBooks();
    renderReaders();
    renderLoans();
    renderPending();
    renderLibrarians();
    renderReports();
    renderPendingBadge();
  }

  function renderSidebar() {
    const current = state();
    const fileName = $("#sidebar-filename");
    const fileMeta = $("#sidebar-file-meta");

    if (!current.db) {
      if (fileName) fileName.textContent = "Nenhum carregado";
      if (fileMeta) fileMeta.textContent = "Importe um arquivo SQLite";
      return;
    }

    const totalRows = current.tables.reduce(
      (total, table) => total + table.rowCount,
      0
    );

    if (fileName) fileName.textContent = current.fileName;
    if (fileMeta) {
      fileMeta.textContent = `${current.tables.length} tabelas · ${utils.formatNumber(
        totalRows
      )} registros`;
    }
  }

  function renderPendingBadge() {
    const badge = $("#nav-pending-badge");
    if (!badge) return;

    const overdue = data().loans.filter(
      loan => utils.loanStatus(loan).key === "overdue"
    ).length;

    badge.hidden = overdue === 0;
    badge.textContent = String(overdue);
  }

  // ============================ BASE DE DADOS ============================

  function renderDatabaseScreen() {
    const current = state();
    const summary = $("#db-summary");
    const dropzone = $("#db-dropzone");

    if (!current.db) {
      if (summary) summary.hidden = true;
      if (dropzone) dropzone.hidden = false;
      return;
    }

    if (summary) summary.hidden = false;
    if (dropzone) dropzone.hidden = true;

    const totalRows = current.tables.reduce(
      (total, table) => total + table.rowCount,
      0
    );
    const entityCount = Object.keys(current.schema.entities).length;

    const fileName = $("#db-file-name");
    const fileSize = $("#db-file-size");
    const tableCount = $("#db-table-count");
    const rowCount = $("#db-row-count");
    const entityCountNode = $("#db-entity-count");
    const integrity = $("#db-integrity");

    if (fileName) fileName.textContent = current.fileName;
    if (fileSize) {
      fileSize.textContent = `${formatBytes(current.fileSize)} · importado em ${utils.formatDate(
        current.importedAt
      )}`;
    }
    if (tableCount) tableCount.textContent = String(current.tables.length);
    if (rowCount) {
      rowCount.textContent = `${utils.formatNumber(totalRows)} registros`;
    }
    if (entityCountNode) entityCountNode.textContent = String(entityCount);
    if (integrity) {
      integrity.textContent = `Integridade: ${current.integrity}`;
    }

    setDbStatus(
      "success",
      "Banco carregado com sucesso",
      `Estrutura reconhecida em ${current.fileName}. Confira o mapeamento abaixo e consulte os registros brutos.`
    );

    renderSchema();
    renderTableInventory();
    populateTableSelector();
    renderRawTable();
  }

  function renderTableInventory() {
    const container = $("#db-table-list");
    if (!container) return;

    const current = state();
    if (!current.schema) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = current.tables
      .map(table => {
        const entity = Object.values(current.schema.entities).find(
          item => item.table === table.name
        );
        const visibleColumns = table.columns.filter(
          column => !isSensitiveColumn(column.name)
        );
        const hiddenCount = table.columns.length - visibleColumns.length;

        const columns = visibleColumns
          .map(
            column =>
              `<span class="column-chip">${utils.escapeHtml(column.name)}${
                column.primaryKey ? " · PK" : ""
              }</span>`
          )
          .join("");

        return `
          <div class="inventory-item">
            <div class="inventory-head">
              <strong>${utils.escapeHtml(table.name)}</strong>
              <span class="pill">${utils.escapeHtml(table.type)}</span>
              <span class="pill">${utils.formatNumber(
                table.rowCount
              )} registro(s)</span>
              ${
                entity
                  ? `<span class="pill is-ok">${utils.escapeHtml(entity.label)}</span>`
                  : '<span class="pill is-warn">não mapeada</span>'
              }
            </div>
            <div class="inventory-columns">
              ${columns}
              ${
                hiddenCount
                  ? `<span class="column-chip is-protected">+${hiddenCount} coluna(s) protegida(s)</span>`
                  : ""
              }
            </div>
          </div>
        `;
      })
      .join("");
  }

  function renderSchema() {    const container = $("#schema-result");
    const warningsContainer = $("#schema-warnings");
    if (!container || !warningsContainer) return;

    const current = state();
    const schema = current.schema;

    if (!schema) {
      container.innerHTML = "";
      warningsContainer.innerHTML = "";
      return;
    }

    const order = ["books", "readers", "librarians", "loans"];
    const cards = [];

    order.forEach(key => {
      const entity = schema.entities[key];
      if (!entity) return;

      const mappings = Object.entries(entity.fields).map(([field, column]) => {
        const label = entity.labels[field] || field;
        return `
          <div class="mapping-item">
            <span>${utils.escapeHtml(label)}</span>
            <code>${utils.escapeHtml(column)}</code>
          </div>
        `;
      });

      const missing = entity.missingRequired.map(field => {
        const definition = BG.schema.ENTITY_DEFINITIONS[key].fields[field];
        return `
          <div class="mapping-item is-missing">
            <span>${utils.escapeHtml(definition.label)}</span>
            <code>não reconhecido</code>
          </div>
        `;
      });

      const ignored = entity.ignoredColumns.filter(
        column => !isSensitiveColumn(column)
      );
      const hasSensitiveIgnored = entity.ignoredColumns.some(isSensitiveColumn);
      const ignoredParts = [];
      if (ignored.length) {
        ignoredParts.push(`Colunas não utilizadas: ${utils.escapeHtml(ignored.join(", "))}.`);
      }
      if (hasSensitiveIgnored) {
        ignoredParts.push("Colunas sensíveis omitidas por segurança.");
      }
      const ignoredNote = ignoredParts.length
        ? `<p class="schema-ignored">${ignoredParts.join(" ")}</p>`
        : "";

      cards.push(`
        <article class="schema-card">
          <div class="schema-card-header">
            <div class="schema-icon" aria-hidden="true">${entity.icon}</div>
            <div>
              <h3>${utils.escapeHtml(entity.label)}</h3>
              <small>tabela <strong>${utils.escapeHtml(entity.table)}</strong></small>
            </div>
          </div>
          <div class="schema-meta">
            <span class="pill ${entity.missingRequired.length ? "is-warn" : "is-ok"}">
              ${utils.formatNumber(entity.rowCount)} registros
            </span>
            <span class="pill ${entity.missingRequired.length ? "is-warn" : "is-ok"}">
              ${
                entity.missingRequired.length
                  ? `${entity.missingRequired.length} campo(s) ausente(s)`
                  : "estrutura completa"
              }
            </span>
          </div>
          <div class="mapping-list">
            ${mappings.join("")}
            ${missing.join("")}
          </div>
          ${ignoredNote}
        </article>
      `);
    });

    if (!cards.length) {
      container.innerHTML =
        '<p class="muted-empty">Nenhuma entidade foi reconhecida.</p>';
    } else {
      container.innerHTML = cards.join("");
    }

    const warningItems = [];
    (schema.warnings || []).forEach(warning => {
      warningItems.push(
        `<div class="warning-item">${utils.escapeHtml(warning)}</div>`
      );
    });

    if (schema.unmatchedTables && schema.unmatchedTables.length) {
      warningItems.push(
        `<div class="warning-item">Tabelas sem entidade associada: ${utils.escapeHtml(
          schema.unmatchedTables.join(", ")
        )}.</div>`
      );
    }

    warningsContainer.innerHTML = warningItems.join("");
  }

  function populateTableSelector() {
    const select = $("#selecionarTabela");
    if (!select) return;

    const current = state();
    const previous = currentRawTable || select.value;
    select.innerHTML = "";

    current.tables.forEach(table => {
      const option = document.createElement("option");
      option.value = table.name;
      option.textContent = `${table.name} (${utils.formatNumber(table.rowCount)})`;
      select.appendChild(option);
    });

    currentRawTable =
      current.tables.find(table => table.name === previous)?.name ||
      current.tables[0]?.name ||
      "";

    select.value = currentRawTable;
  }

  function renderRawTable() {
    const table = $("#tabelaVisualizacao");
    const counter = $("#totalRegistros");
    if (!table) return;

    const current = state();
    const thead = table.querySelector("thead");
    const tbody = table.querySelector("tbody");
    const tableInfo = current.tables.find(
      item => item.name === currentRawTable
    );

    if (!tableInfo) {
      thead.innerHTML = "";
      tbody.innerHTML =
        '<tr><td class="empty-state">Nenhuma tabela selecionada.</td></tr>';
      if (counter) counter.textContent = "";
      return;
    }

    const term = utils.normalizeSearch($("#raw-search")?.value || "");
    const rows = BG.database.rawRows(tableInfo.name).filter(row => {
      if (!term) return true;
      return tableInfo.columns.some(column =>
        utils
          .normalizeSearch(displayValue(row[column.name]))
          .includes(term)
      );
    });

    thead.innerHTML = "";
    const headerRow = document.createElement("tr");
    tableInfo.columns.forEach(column => {
      const th = document.createElement("th");
      th.textContent = isSensitiveColumn(column.name)
        ? "Coluna protegida"
        : column.name;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    tbody.innerHTML = "";

    if (!rows.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = Math.max(tableInfo.columns.length, 1);
      td.className = "empty-state";
      td.textContent = term
        ? "Nenhum registro corresponde à busca."
        : "Esta tabela não possui registros.";
      tr.appendChild(td);
      tbody.appendChild(tr);
    } else {
      rows.slice(0, 100).forEach(row => {
        const tr = document.createElement("tr");
        tableInfo.columns.forEach(column => {
          const td = document.createElement("td");
          td.textContent = maskedValue(column.name, row[column.name]);
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    }

    if (counter) {
      const shown = Math.min(rows.length, 100);
      counter.textContent = `Mostrando ${utils.formatNumber(
        shown
      )} de ${utils.formatNumber(rows.length)} registros da tabela "${
        tableInfo.name
      }".`;
    }
  }

  // ============================ TELAS ============================

  function statusPill(status, extra) {
    const label = extra || status.label;
    return `<span class="status-pill ${status.tone}">${utils.escapeHtml(
      label
    )}</span>`;
  }

  function renderBarList(container, items, options) {
    if (!container) return;
    const settings = options || {};

    if (!items.length) {
      container.innerHTML = `<p class="muted-empty">${
        settings.emptyMessage || "Sem dados para exibir."
      }</p>`;
      return;
    }

    const max = Math.max(...items.map(item => item.count), 1);
    const tones = settings.tones || ["", "is-green", "is-amber", "is-slate"];

    container.innerHTML = items
      .map((item, index) => {
        const width = Math.max((item.count / max) * 100, item.count ? 4 : 0);
        const tone = item.tone || tones[index % tones.length] || "";
        return `
          <div class="bar-item">
            <div class="bar-label">
              <span>${utils.escapeHtml(item.label)}</span>
              <strong>${utils.formatNumber(item.count)}</strong>
            </div>
            <div class="bar-track">
              <div class="bar-fill ${tone}" style="width:${width}%"></div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function renderOverview() {
    const empty = $("#overview-empty");
    const content = $("#overview-content");
    if (!empty || !content) return;

    if (!hasAnyData()) {
      empty.hidden = false;
      content.hidden = true;
      return;
    }

    empty.hidden = true;
    content.hidden = false;

    const dataset = data();
    const view = BG.analytics.compute(dataset);
    const metrics = view.metrics;

    const setText = (selector, value) => {
      const node = $(selector);
      if (node) node.textContent = value;
    };

    setText("#kpi-books", utils.formatNumber(metrics.books));
    setText(
      "#kpi-books-note",
      `${utils.formatNumber(metrics.availableBooks)} disponíveis para empréstimo`
    );
    setText("#kpi-readers", utils.formatNumber(metrics.readers));
    setText(
      "#kpi-readers-note",
      `${utils.formatNumber(metrics.activeReaders)} com cadastro ativo`
    );
    setText("#kpi-active-loans", utils.formatNumber(metrics.activeLoans));
    setText(
      "#kpi-active-loans-note",
      metrics.dueTodayLoans
        ? `${metrics.dueTodayLoans} vencem hoje`
        : "Livros em circulação"
    );
    setText("#kpi-overdue", utils.formatNumber(metrics.overdueLoans));
    setText(
      "#kpi-overdue-note",
      `${utils.formatNumber(metrics.readersWithPending)} aluno(s) com pendência`
    );
    setText("#kpi-returned", utils.formatNumber(metrics.returnedLoans));
    setText("#kpi-returned-note", "Empréstimos concluídos");

    const alert = $("#overview-alert");
    if (alert) {
      const title = $("#overview-alert-title");
      const text = $("#overview-alert-text");

      if (metrics.overdueLoans > 0) {
        alert.className = "alert-panel alert-warning";
        if (title) {
          title.textContent = `${utils.formatNumber(
            metrics.overdueLoans
          )} devolução(ões) em atraso`;
        }
        if (text) {
          text.textContent = `${utils.formatNumber(
            metrics.readersWithPending
          )} aluno(s) precisam ser contatados. Priorize as pendências mais antigas.`;
        }
      } else {
        alert.className = "alert-panel alert-success";
        if (title) title.textContent = "Nenhuma devolução em atraso";
        if (text) {
          text.textContent =
            "Todas as devoluções estão dentro do prazo. Continue acompanhando os empréstimos que vencem hoje.";
        }
      }
    }

    renderBarList(
      $("#overview-status-list"),
      view.statusCounts,
      {
        tones: ["", "is-amber", "is-red", "is-green", "is-slate"],
        emptyMessage: "Nenhum empréstimo registrado."
      }
    );

    const origins = utils.groupCount(
      dataset.books,
      book => book.origin || "Não informada"
    );
    renderBarList($("#overview-origin-list"), origins, {
      emptyMessage: "Nenhum livro cadastrado."
    });

    const recentBody = $("#recent-loans-body");
    if (recentBody) {
      const recent = view.recentLoans.slice(0, 5);
      if (!recent.length) {
        recentBody.innerHTML =
          '<tr><td colspan="4" class="empty-state">Nenhum empréstimo registrado.</td></tr>';
      } else {
        recentBody.innerHTML = recent
          .map(loan => {
            const bookSub = loan.bookAuthor
              ? loan.bookAuthor
              : loan.bookCode
                ? `Tombo ${loan.bookCode}`
                : "Livro não identificado";
            const readerSub = loan.readerRegistration
              ? `Matrícula ${loan.readerRegistration}`
              : "Aluno não identificado";
            return `
              <tr>
                <td>
                  <span class="cell-title">${utils.escapeHtml(loan.bookTitle)}</span>
                  <span class="cell-sub">${utils.escapeHtml(bookSub)}</span>
                </td>
                <td>
                  <span class="cell-title">${utils.escapeHtml(loan.readerName)}</span>
                  <span class="cell-sub">${utils.escapeHtml(readerSub)}</span>
                </td>
                <td>${utils.formatDate(loan.dueDate)}</td>
                <td>${statusPill(loan.status)}</td>
              </tr>
            `;
          })
          .join("");
      }
    }
  }

  function bookStatusView(book, activeLoan) {
    const key = utils.itemStatusKey(book.status, Boolean(activeLoan));
    const toneMap = {
      available: "success",
      borrowed: "warning",
      discarded: "neutral",
      reserved: "info",
      maintenance: "warning",
      unknown: "neutral"
    };
    return {
      key,
      label: utils.itemStatusLabel(book.status, Boolean(activeLoan)),
      tone: toneMap[key] || "neutral"
    };
  }

  function renderBooks() {
    const body = $("#books-body");
    const counter = $("#book-count");
    if (!body || !counter) return;

    const dataset = data();

    if (!hasAnyData()) {
      body.innerHTML =
        '<tr><td colspan="8" class="empty-state">Importe um banco de dados para visualizar o acervo.</td></tr>';
      counter.textContent = "Nenhum livro carregado.";
      return;
    }

    if (!dataset.books.length) {
      body.innerHTML =
        '<tr><td colspan="8" class="empty-state">Nenhum livro foi reconhecido no banco importado.</td></tr>';
      counter.textContent = "Nenhum livro carregado.";
      return;
    }

    const view = BG.analytics.compute(dataset);
    const search = utils.normalizeSearch($("#book-search")?.value || "");
    const statusFilter = $("#book-status-filter")?.value || "";
    const sort = $("#book-sort")?.value || "title";

    const decorated = dataset.books.map(book => {
      const activeLoan = view.activeByBook.get(book.key) || null;
      return {
        ...book,
        activeLoan,
        statusView: bookStatusView(book, activeLoan),
        searchText: utils.normalizeSearch(
          [
            book.code,
            book.title,
            book.author,
            book.publisher,
            book.origin,
            book.category,
            book.year
          ].join(" ")
        )
      };
    });

    const filtered = decorated.filter(book => {
      if (search && !book.searchText.includes(search)) return false;
      if (statusFilter && book.statusView.key !== statusFilter) return false;
      return true;
    });

    const compareText = (a, b) =>
      String(a || "").localeCompare(String(b || ""), "pt-BR", {
        sensitivity: "base"
      });

    filtered.sort((a, b) => {
      if (sort === "author") {
        return compareText(a.author, b.author) || compareText(a.title, b.title);
      }
      if (sort === "acquiredAt") {
        const aTime = a.acquiredAt ? a.acquiredAt.getTime() : -Infinity;
        const bTime = b.acquiredAt ? b.acquiredAt.getTime() : -Infinity;
        return bTime - aTime || compareText(a.title, b.title);
      }
      if (sort === "code") {
        const aNumber = Number(a.code);
        const bNumber = Number(b.code);
        if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
          return aNumber - bNumber;
        }
        return compareText(a.code, b.code);
      }
      return compareText(a.title, b.title);
    });

    counter.textContent = `${utils.formatNumber(filtered.length)} de ${utils.formatNumber(
      dataset.books.length
    )} livro(s) exibido(s).`;

    if (!filtered.length) {
      body.innerHTML =
        '<tr><td colspan="8" class="empty-state">Nenhum livro corresponde aos filtros selecionados.</td></tr>';
      return;
    }

    body.innerHTML = filtered
      .map(book => {
        const details =
          book.category || book.year
            ? `${book.category || ""}${book.category && book.year ? " · " : ""}${
                book.year || ""
              }`
            : "";
        const activeLoan = book.activeLoan
          ? `
            <span class="cell-title">${utils.escapeHtml(book.activeLoan.readerName)}</span>
            <span class="cell-sub">desde ${utils.formatDate(
              book.activeLoan.loanDate
            )} · devolver até ${utils.formatDate(book.activeLoan.dueDate)}</span>
          `
          : '<span class="cell-sub">—</span>';

        return `
          <tr>
            <td><strong>${utils.escapeHtml(book.code || "—")}</strong></td>
            <td>
              <span class="cell-title">${utils.escapeHtml(book.title)}</span>
              ${details ? `<span class="cell-sub">${utils.escapeHtml(details)}</span>` : ""}
            </td>
            <td>${utils.escapeHtml(book.author || "—")}</td>
            <td>${utils.escapeHtml(book.publisher || "—")}</td>
            <td>${utils.escapeHtml(book.origin || "—")}</td>
            <td>${utils.formatDate(book.acquiredAt)}</td>
            <td>${statusPill(book.statusView)}</td>
            <td>${activeLoan}</td>
          </tr>
        `;
      })
      .join("");
  }

  function renderReaders() {
    const body = $("#readers-body");
    const counter = $("#reader-count");
    const classSelect = $("#reader-class-filter");
    if (!body || !counter) return;

    const dataset = data();

    if (!hasAnyData()) {
      body.innerHTML =
        '<tr><td colspan="8" class="empty-state">Importe um banco de dados para visualizar os alunos.</td></tr>';
      counter.textContent = "Nenhum aluno carregado.";
      if (classSelect) {
        classSelect.innerHTML = '<option value="">Todas as turmas</option>';
      }
      return;
    }

    if (classSelect) {
      const previous = classSelect.value;
      const classes = Array.from(
        new Set(dataset.readers.map(reader => reader.className).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
      const options = ['<option value="">Todas as turmas</option>'];
      classes.forEach(className => {
        options.push(
          `<option value="${utils.escapeHtml(className)}">${utils.escapeHtml(
            className
          )}</option>`
        );
      });
      if (dataset.readers.some(reader => !reader.className)) {
        options.push('<option value="__empty__">Sem turma</option>');
      }
      classSelect.innerHTML = options.join("");
      classSelect.value = classes.includes(previous) ? previous : "";
    }

    if (!dataset.readers.length) {
      body.innerHTML =
        '<tr><td colspan="8" class="empty-state">Nenhum aluno foi reconhecido no banco importado.</td></tr>';
      counter.textContent = "Nenhum aluno carregado.";
      return;
    }

    const view = BG.analytics.compute(dataset);
    const search = utils.normalizeSearch($("#reader-search")?.value || "");
    const classFilter = classSelect?.value || "";
    const statusFilter = $("#reader-status-filter")?.value || "";

    const decorated = dataset.readers.map(reader => ({
      ...reader,
      activeLoans: view.activeByReader.get(reader.key) || 0,
      pendingLoans: view.overdueByReader.get(reader.key) || 0,
      isActive: utils.readerIsActive(reader.status),
      searchText: utils.normalizeSearch(
        [
          reader.registration,
          reader.name,
          reader.className,
          reader.email,
          reader.phone,
          reader.gender
        ].join(" ")
      )
    }));

    const filtered = decorated.filter(reader => {
      if (search && !reader.searchText.includes(search)) return false;
      if (classFilter === "__empty__" && reader.className) return false;
      if (classFilter && classFilter !== "__empty__" && reader.className !== classFilter) {
        return false;
      }
      if (statusFilter === "active" && !reader.isActive) return false;
      if (statusFilter === "inactive" && reader.isActive) return false;
      return true;
    });

    filtered.sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })
    );

    counter.textContent = `${utils.formatNumber(filtered.length)} de ${utils.formatNumber(
      dataset.readers.length
    )} aluno(s) exibido(s).`;

    if (!filtered.length) {
      body.innerHTML =
        '<tr><td colspan="8" class="empty-state">Nenhum aluno corresponde aos filtros selecionados.</td></tr>';
      return;
    }

    body.innerHTML = filtered
      .map(reader => {
        const status = {
          tone: reader.isActive ? "success" : "neutral",
          label: utils.readerStatusLabel(reader.status)
        };

        const actionMessage =
          reader.pendingLoans > 0
            ? `Olá, ${reader.name}! Identificamos ${reader.pendingLoans} empréstimo(s) em atraso na biblioteca. Podemos combinar a devolução?`
            : `Olá, ${reader.name}! Aqui é da biblioteca escolar.`;
        const whatsapp = utils.whatsappLink(reader.phone, actionMessage);

        const contact = [
          reader.phone ? utils.formatPhone(reader.phone) : "",
          reader.email
        ]
          .filter(Boolean)
          .map((item, index) =>
            index === 0
              ? `<span class="cell-title">${utils.escapeHtml(item)}</span>`
              : `<span class="cell-sub">${utils.escapeHtml(item)}</span>`
          )
          .join("");

        return `
          <tr>
            <td><strong>${utils.escapeHtml(reader.registration || "—")}</strong></td>
            <td>
              <span class="cell-title">${utils.escapeHtml(reader.name)}</span>
              ${reader.gender ? `<span class="cell-sub">${utils.escapeHtml(reader.gender)}</span>` : ""}
            </td>
            <td>${utils.escapeHtml(reader.className || "—")}</td>
            <td>${contact || "—"}</td>
            <td>${statusPill(status)}</td>
            <td><strong>${utils.formatNumber(reader.activeLoans)}</strong></td>
            <td>${
              reader.pendingLoans
                ? `<span class="status-pill danger">${utils.formatNumber(
                    reader.pendingLoans
                  )}</span>`
                : '<span class="cell-sub">0</span>'
            }</td>
            <td>${
              whatsapp
                ? `<a class="link-button" href="${utils.escapeHtml(
                    whatsapp
                  )}" target="_blank" rel="noopener noreferrer">WhatsApp ↗</a>`
                : '<span class="cell-sub">Sem telefone</span>'
            }</td>
          </tr>
        `;
      })
      .join("");
  }

  function loanDeadlineLabel(loan) {
    if (loan.returnDate) {
      return loan.returnDate
        ? `Devolvido em ${utils.formatDate(loan.returnDate)}`
        : "Devolvido";
    }
    if (loan.status.key === "overdue") {
      return `${utils.formatNumber(loan.status.days)} dia(s) em atraso`;
    }
    if (loan.status.key === "dueToday") return "Vence hoje";
    if (loan.status.key === "active") {
      return `${utils.formatNumber(loan.status.days)} dia(s) restante(s)`;
    }
    return "Sem data de devolução";
  }

  function renderLoanSummary(view) {
    const container = $("#loan-summary");
    if (!container) return;

    if (!hasAnyData()) {
      container.innerHTML = "";
      return;
    }

    const metrics = view.metrics;
    const chips = [
      { label: "Todos", count: metrics.loans, tone: "" },
      { label: "Em andamento", count: metrics.activeLoans, tone: "" },
      { label: "Vence hoje", count: metrics.dueTodayLoans, tone: "is-warning" },
      { label: "Atrasados", count: metrics.overdueLoans, tone: "is-danger" },
      { label: "Devolvidos", count: metrics.returnedLoans, tone: "is-success" }
    ];

    if (view.unknownLoans.length) {
      chips.push({
        label: "Sem data",
        count: view.unknownLoans.length,
        tone: ""
      });
    }

    container.innerHTML = chips
      .map(
        chip => `
          <span class="chip ${chip.tone}">
            ${utils.escapeHtml(chip.label)}
            <strong>${utils.formatNumber(chip.count)}</strong>
          </span>
        `
      )
      .join("");
  }

  function renderLoans() {
    const body = $("#loans-body");
    const counter = $("#loan-count");
    if (!body || !counter) return;

    const dataset = data();
    const view = BG.analytics.compute(dataset);
    renderLoanSummary(view);

    if (!hasAnyData()) {
      body.innerHTML =
        '<tr><td colspan="9" class="empty-state">Importe um banco de dados para visualizar os empréstimos.</td></tr>';
      counter.textContent = "Nenhum empréstimo carregado.";
      return;
    }

    if (!dataset.loans.length) {
      body.innerHTML =
        '<tr><td colspan="9" class="empty-state">Nenhum empréstimo foi reconhecido no banco importado.</td></tr>';
      counter.textContent = "Nenhum empréstimo carregado.";
      return;
    }

    const search = utils.normalizeSearch($("#loan-search")?.value || "");
    const statusFilter = $("#loan-status-filter")?.value || "";

    const filtered = view.loans.filter(loan => {
      if (statusFilter && loan.status.key !== statusFilter) return false;
      if (!search) return true;
      const haystack = utils.normalizeSearch(
        [
          loan.id,
          loan.bookTitle,
          loan.bookAuthor,
          loan.bookCode,
          loan.readerName,
          loan.readerRegistration,
          loan.className,
          loan.librarianName
        ].join(" ")
      );
      return haystack.includes(search);
    });

    const priority = {
      overdue: 0,
      dueToday: 1,
      active: 2,
      unknown: 3,
      returned: 4
    };
    const dateValue = value =>
      value instanceof Date ? value.getTime() : 0;

    filtered.sort((a, b) => {
      const difference =
        (priority[a.status.key] ?? 9) - (priority[b.status.key] ?? 9);
      if (difference !== 0) return difference;

      if (a.status.key === "overdue" && b.status.key === "overdue") {
        return b.status.days - a.status.days;
      }
      if (a.status.key === "active" && b.status.key === "active") {
        return dateValue(a.dueDate) - dateValue(b.dueDate);
      }
      if (a.status.key === "returned" && b.status.key === "returned") {
        return dateValue(b.returnDate) - dateValue(a.returnDate);
      }
      return dateValue(b.loanDate) - dateValue(a.loanDate);
    });

    counter.textContent = `${utils.formatNumber(filtered.length)} de ${utils.formatNumber(
      view.loans.length
    )} empréstimo(s) exibido(s).`;

    if (!filtered.length) {
      body.innerHTML =
        '<tr><td colspan="9" class="empty-state">Nenhum empréstimo corresponde aos filtros selecionados.</td></tr>';
      return;
    }

    body.innerHTML = filtered
      .map(loan => {
        const bookSub = loan.bookAuthor || (loan.bookCode ? `Tombo ${loan.bookCode}` : "");
        const readerSub = loan.readerRegistration
          ? `Matrícula ${loan.readerRegistration}`
          : "";

        return `
          <tr>
            <td><strong>${utils.escapeHtml(loan.id || "—")}</strong></td>
            <td>
              <span class="cell-title">${utils.escapeHtml(loan.bookTitle)}</span>
              ${bookSub ? `<span class="cell-sub">${utils.escapeHtml(bookSub)}</span>` : ""}
            </td>
            <td>
              <span class="cell-title">${utils.escapeHtml(loan.readerName)}</span>
              ${readerSub ? `<span class="cell-sub">${utils.escapeHtml(readerSub)}</span>` : ""}
            </td>
            <td>${utils.escapeHtml(loan.className || "—")}</td>
            <td>${utils.escapeHtml(loan.librarianName || "—")}</td>
            <td>${utils.formatDate(loan.loanDate)}</td>
            <td>${utils.formatDate(loan.dueDate)}</td>
            <td>${loanDeadlineLabel(loan)}</td>
            <td>${statusPill(loan.status)}</td>
          </tr>
        `;
      })
      .join("");
  }

  function renderPending() {
    const body = $("#pending-body");
    const counter = $("#pending-count");
    const average = $("#pending-average");
    const readers = $("#pending-readers");
    const message = $("#pending-message");
    if (!body) return;

    const dataset = data();
    const view = BG.analytics.compute(dataset);
    const pending = view.pendingLoans;

    const averageDays = pending.length
      ? pending.reduce((total, loan) => total + loan.status.days, 0) /
        pending.length
      : 0;

    if (counter) counter.textContent = utils.formatNumber(pending.length);
    if (average) {
      average.textContent = `${new Intl.NumberFormat("pt-BR", {
        minimumFractionDigits: pending.length ? 1 : 0,
        maximumFractionDigits: 1
      }).format(averageDays)} dia(s)`;
    }
    if (readers) {
      readers.textContent = utils.formatNumber(view.metrics.readersWithPending);
    }

    if (!hasAnyData()) {
      body.innerHTML =
        '<tr><td colspan="8" class="empty-state">Importe um banco de dados para visualizar as pendências.</td></tr>';
      if (message) message.textContent = "Nenhuma pendência carregada.";
      return;
    }

    if (!pending.length) {
      body.innerHTML =
        '<tr><td colspan="8" class="empty-state"><div class="empty-state-icon" aria-hidden="true">✅</div>Nenhuma devolução em atraso. Todo o acervo está em dia.</td></tr>';
      if (message) {
        message.textContent = "Nenhuma devolução em atraso no momento.";
      }
      return;
    }

    if (message) {
      message.textContent = `${utils.formatNumber(
        pending.length
      )} empréstimo(s) em atraso. Priorize os contatos mais antigos.`;
    }

    body.innerHTML = pending
      .map(loan => {
        const whatsappMessage = `Olá, ${loan.readerName}! O livro "${loan.bookTitle}" está com devolução prevista para ${utils.formatDate(
          loan.dueDate
        )} e consta em atraso há ${utils.formatNumber(
          loan.status.days
        )} dia(s). Podemos combinar a devolução?`;
        const whatsapp = utils.whatsappLink(loan.readerPhone, whatsappMessage);
        const bookSub =
          loan.bookAuthor || (loan.bookCode ? `Tombo ${loan.bookCode}` : "");
        const readerSub = loan.readerRegistration
          ? `Matrícula ${loan.readerRegistration}`
          : "";

        return `
          <tr>
            <td>
              <span class="cell-title">${utils.escapeHtml(loan.readerName)}</span>
              ${readerSub ? `<span class="cell-sub">${utils.escapeHtml(readerSub)}</span>` : ""}
            </td>
            <td>${utils.escapeHtml(loan.className || "—")}</td>
            <td>${utils.escapeHtml(
              loan.readerPhone ? utils.formatPhone(loan.readerPhone) : "—"
            )}</td>
            <td>
              <span class="cell-title">${utils.escapeHtml(loan.bookTitle)}</span>
              ${bookSub ? `<span class="cell-sub">${utils.escapeHtml(bookSub)}</span>` : ""}
            </td>
            <td>${utils.formatDate(loan.dueDate)}</td>
            <td>
              <span class="status-pill danger">${utils.formatNumber(
                loan.status.days
              )} dia(s)</span>
            </td>
            <td>${utils.escapeHtml(loan.librarianName || "—")}</td>
            <td>
              ${
                whatsapp
                  ? `<a class="link-button" href="${utils.escapeHtml(
                      whatsapp
                    )}" target="_blank" rel="noopener noreferrer">Cobrar no WhatsApp ↗</a>`
                  : '<span class="cell-sub">Sem telefone</span>'
              }
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function renderLibrarians() {
    const body = $("#librarians-body");
    const counter = $("#librarian-count");
    if (!body || !counter) return;

    const dataset = data();

    if (!hasAnyData()) {
      body.innerHTML =
        '<tr><td colspan="6" class="empty-state">Importe um banco de dados para visualizar os bibliotecários.</td></tr>';
      counter.textContent = "Nenhum bibliotecário carregado.";
      return;
    }

    if (!dataset.librarians.length) {
      body.innerHTML =
        '<tr><td colspan="6" class="empty-state">Nenhum bibliotecário foi reconhecido no banco importado.</td></tr>';
      counter.textContent = "Nenhum bibliotecário carregado.";
      return;
    }

    const view = BG.analytics.compute(dataset);
    const search = utils.normalizeSearch($("#librarian-search")?.value || "");
    const totalLoans = view.loans.length;

    const loanCounts = new Map();
    view.loans.forEach(loan => {
      if (!loan.librarianKey) return;
      loanCounts.set(
        loan.librarianKey,
        (loanCounts.get(loan.librarianKey) || 0) + 1
      );
    });

    const decorated = dataset.librarians.map(librarian => ({
      ...librarian,
      loanCount: loanCounts.get(librarian.key) || 0,
      searchText: utils.normalizeSearch(
        [
          librarian.registration,
          librarian.name,
          librarian.login,
          librarian.phone
        ].join(" ")
      )
    }));

    const filtered = decorated
      .filter(librarian => {
        if (!search) return true;
        return librarian.searchText.includes(search);
      })
      .sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })
      );

    counter.textContent = `${utils.formatNumber(filtered.length)} de ${utils.formatNumber(
      dataset.librarians.length
    )} bibliotecário(s) exibido(s).`;

    if (!filtered.length) {
      body.innerHTML =
        '<tr><td colspan="6" class="empty-state">Nenhum bibliotecário corresponde aos filtros selecionados.</td></tr>';
      return;
    }

    body.innerHTML = filtered
      .map(librarian => {
        const participation = totalLoans
          ? (librarian.loanCount / totalLoans) * 100
          : 0;
        return `
          <tr>
            <td><strong>${utils.escapeHtml(librarian.registration || "—")}</strong></td>
            <td>
              <span class="cell-title">${utils.escapeHtml(librarian.name)}</span>
            </td>
            <td>${utils.escapeHtml(librarian.login || "—")}</td>
            <td>${utils.escapeHtml(
              librarian.phone ? utils.formatPhone(librarian.phone) : "—"
            )}</td>
            <td><strong>${utils.formatNumber(
              librarian.loanCount
            )}</strong> <span class="cell-sub">de ${utils.formatNumber(
              totalLoans
            )}</span></td>
            <td>
              <div class="bar-track" title="${utils.escapeHtml(
                utils.formatPercent(participation)
              )}">
                <div class="bar-fill" style="width:${Math.max(
                  participation,
                  librarian.loanCount ? 3 : 0
                )}%"></div>
              </div>
              <span class="cell-sub">${utils.formatPercent(participation)}</span>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function renderRanking(container, items, emptyMessage) {
    if (!container) return;

    if (!items.length) {
      container.innerHTML = `<p class="muted-empty">${utils.escapeHtml(
        emptyMessage || "Sem dados para exibir."
      )}</p>`;
      return;
    }

    const max = Math.max(...items.map(item => item.count), 1);
    container.innerHTML = items
      .map((item, index) => {
        const width = Math.max((item.count / max) * 100, item.count ? 4 : 0);
        return `
          <div class="ranking-item">
            <span class="ranking-position">${index + 1}</span>
            <div class="ranking-body">
              <div class="ranking-name">
                <span>${utils.escapeHtml(item.label)}</span>
                <strong>${utils.formatNumber(item.count)}</strong>
              </div>
              <div class="bar-track">
                <div class="bar-fill" style="width:${width}%"></div>
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function reportBreakdown(dataset, view) {
    const authors = utils.groupCount(
      dataset.books,
      book => book.author || "Não informado"
    );
    const classes = utils.groupCount(
      view.loans,
      loan => loan.className || "Sem turma"
    );
    const origins = utils.groupCount(
      dataset.books,
      book => book.origin || "Não informada"
    );
    const statuses = utils.groupCount(dataset.books, book =>
      utils.itemStatusLabel(
        book.status,
        Boolean(view.activeByBook.get(book.key))
      )
    );

    return { authors, classes, origins, statuses };
  }

  function renderReports() {
    const empty = $("#reports-empty");
    const content = $("#reports-content");
    if (!empty || !content) return;

    if (!hasAnyData()) {
      empty.hidden = false;
      content.hidden = true;
      return;
    }

    empty.hidden = true;
    content.hidden = false;

    const dataset = data();
    const view = BG.analytics.compute(dataset);
    const metrics = view.metrics;
    const breakdown = reportBreakdown(dataset, view);

    const occupancy = metrics.books
      ? (view.activeByBook.size / metrics.books) * 100
      : 0;
    const averageLoans = metrics.readers
      ? metrics.activeLoans / metrics.readers
      : 0;
    const overdueRate = metrics.activeLoans
      ? (metrics.overdueLoans / metrics.activeLoans) * 100
      : 0;

    const setText = (selector, value) => {
      const node = $(selector);
      if (node) node.textContent = value;
    };

    setText("#report-occupancy", utils.formatPercent(occupancy));
    setText(
      "#report-average",
      new Intl.NumberFormat("pt-BR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 1
      }).format(averageLoans)
    );
    setText("#report-overdue-rate", utils.formatPercent(overdueRate));

    renderRanking(
      $("#report-authors"),
      breakdown.authors.slice(0, 10),
      "Nenhum autor identificado no acervo."
    );

    renderBarList($("#report-classes"), breakdown.classes, {
      tones: ["", "is-green", "is-amber", "is-slate"],
      emptyMessage: "Nenhum empréstimo registrado."
    });

    renderBarList($("#report-origins"), breakdown.origins, {
      tones: ["", "is-green", "is-amber", "is-slate"],
      emptyMessage: "Nenhum livro cadastrado."
    });

    renderBarList($("#report-status"), breakdown.statuses, {
      tones: ["is-green", "is-amber", "is-slate", "is-red"],
      emptyMessage: "Nenhum livro cadastrado."
    });
  }

  function exportReportCsv() {
    if (!hasAnyData()) {
      showToast("Importe um banco de dados para exportar o relatório.", "error");
      return;
    }

    const dataset = data();
    const view = BG.analytics.compute(dataset);
    const metrics = view.metrics;
    const breakdown = reportBreakdown(dataset, view);

    const occupancy = metrics.books
      ? (view.activeByBook.size / metrics.books) * 100
      : 0;
    const averageLoans = metrics.readers
      ? metrics.activeLoans / metrics.readers
      : 0;
    const overdueRate = metrics.activeLoans
      ? (metrics.overdueLoans / metrics.activeLoans) * 100
      : 0;

    const rows = [
      ["Indicador", "Livros no acervo", metrics.books],
      ["Indicador", "Alunos cadastrados", metrics.readers],
      ["Indicador", "Bibliotecários", metrics.librarians],
      ["Indicador", "Empréstimos registrados", metrics.loans],
      ["Indicador", "Empréstimos ativos", metrics.activeLoans],
      ["Indicador", "Empréstimos em atraso", metrics.overdueLoans],
      ["Indicador", "Empréstimos devolvidos", metrics.returnedLoans],
      ["Indicador", "Ocupação do acervo", utils.formatPercent(occupancy)],
      [
        "Indicador",
        "Média de empréstimos ativos por aluno",
        new Intl.NumberFormat("pt-BR", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        }).format(averageLoans)
      ],
      ["Indicador", "Percentual de atraso", utils.formatPercent(overdueRate)]
    ];

    breakdown.authors.forEach(item => {
      rows.push(["Ranking de autores", item.label, item.count]);
    });
    breakdown.classes.forEach(item => {
      rows.push(["Empréstimos por turma", item.label, item.count]);
    });
    breakdown.origins.forEach(item => {
      rows.push(["Acervo por origem", item.label, item.count]);
    });
    breakdown.statuses.forEach(item => {
      rows.push(["Acervo por situação", item.label, item.count]);
    });

    const today = utils.today();
    const stamp = `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    utils.downloadCsv(
      `relatorio-bibliogestao-${stamp}.csv`,
      ["Categoria", "Item", "Valor"],
      rows
    );
    showToast("Relatório exportado em CSV.", "success");
  }

  // ============================ FILTROS ============================

  function clearBookFilters() {
    const search = $("#book-search");
    const status = $("#book-status-filter");
    const sort = $("#book-sort");
    if (search) search.value = "";
    if (status) status.value = "";
    if (sort) sort.value = "title";
    renderBooks();
  }

  function clearReaderFilters() {
    const search = $("#reader-search");
    const className = $("#reader-class-filter");
    const status = $("#reader-status-filter");
    if (search) search.value = "";
    if (className) className.value = "";
    if (status) status.value = "";
    renderReaders();
  }

  function clearLoanFilters() {
    const search = $("#loan-search");
    const status = $("#loan-status-filter");
    if (search) search.value = "";
    if (status) status.value = "";
    renderLoans();
  }

  function clearLibrarianFilters() {
    const search = $("#librarian-search");
    if (search) search.value = "";
    renderLibrarians();
  }

  // ============================ EVENTOS ============================

  function initEvents() {
    $all(".sidebar-menu .nav-item").forEach(item => {
      item.addEventListener("click", () => goToScreen(item.dataset.screenTarget));
    });

    document.addEventListener("click", event => {
      const screenTarget = event.target.closest("[data-screen-target]");
      if (screenTarget && !screenTarget.classList.contains("nav-item")) {
        goToScreen(screenTarget.dataset.screenTarget);
        return;
      }

      const action = event.target.closest("[data-action]");
      if (!action) return;

      switch (action.dataset.action) {
        case "open-db":
          $("#sqlDatabaseUploader")?.click();
          break;
        case "load-sample":
          event.stopPropagation();
          handleSample();
          break;
        case "clear-book-filters":
          clearBookFilters();
          break;
        case "clear-reader-filters":
          clearReaderFilters();
          break;
        case "clear-loan-filters":
          clearLoanFilters();
          break;
        case "clear-librarian-filters":
          clearLibrarianFilters();
          break;
        default:
          break;
      }
    });

    $("#btnAbrirBancoSQL")?.addEventListener("click", () => {
      $("#sqlDatabaseUploader")?.click();
    });

    $("#sqlDatabaseUploader")?.addEventListener("change", event => {
      handleFile(event.target.files?.[0]);
    });

    $("#btnCarregarExemplo")?.addEventListener("click", handleSample);

    const dropzone = $("#db-dropzone");
    dropzone?.addEventListener("click", event => {
      if (event.target.closest("[data-action='load-sample']")) return;
      $("#sqlDatabaseUploader")?.click();
    });
    dropzone?.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        $("#sqlDatabaseUploader")?.click();
      }
    });
    ["dragenter", "dragover"].forEach(type => {
      dropzone?.addEventListener(type, event => {
        event.preventDefault();
        dropzone.classList.add("is-dragging");
      });
    });
    ["dragleave", "dragend"].forEach(type => {
      dropzone?.addEventListener(type, () => {
        dropzone.classList.remove("is-dragging");
      });
    });
    dropzone?.addEventListener("drop", event => {
      event.preventDefault();
      dropzone.classList.remove("is-dragging");
      const file = event.dataTransfer?.files?.[0];
      if (file) handleFile(file);
    });

    window.addEventListener("dragover", event => event.preventDefault());
    window.addEventListener("drop", event => {
      if (!event.target.closest("#db-dropzone")) event.preventDefault();
    });

    $("#selecionarTabela")?.addEventListener("change", event => {
      currentRawTable = event.target.value;
      renderRawTable();
    });

    $("#raw-search")?.addEventListener(
      "input",
      utils.debounce(renderRawTable, 160)
    );

    $("#btnFecharBanco")?.addEventListener("click", closeDatabase);
    $("#btnExportarRelatorio")?.addEventListener("click", exportReportCsv);

    $("#book-search")?.addEventListener("input", utils.debounce(renderBooks, 140));
    $("#book-status-filter")?.addEventListener("change", renderBooks);
    $("#book-sort")?.addEventListener("change", renderBooks);
    $("#reader-search")?.addEventListener(
      "input",
      utils.debounce(renderReaders, 140)
    );
    $("#reader-class-filter")?.addEventListener("change", renderReaders);
    $("#reader-status-filter")?.addEventListener("change", renderReaders);
    $("#loan-search")?.addEventListener("input", utils.debounce(renderLoans, 140));
    $("#loan-status-filter")?.addEventListener("change", renderLoans);
    $("#librarian-search")?.addEventListener(
      "input",
      utils.debounce(renderLibrarians, 140)
    );
  }

  document.addEventListener("DOMContentLoaded", () => {
    initEvents();
    renderAll();
  });

  BG.app = {
    goToScreen,
    renderAll,
    showToast
  };
})();
