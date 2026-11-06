/* BIBLIOGESTÃO - SISTEMA DE GERENCIAMENTO */

const STORAGE_KEY = "bibliogestao_v2";

const state = loadState();

const $ = (selector) => document.querySelector(selector);

const $$ = (selector) => [...document.querySelectorAll(selector)];

function emptyState() {
  return {
    books: [],
    students: [],
    loans: []
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

    if (
      saved &&
      Array.isArray(saved.books) &&
      Array.isArray(saved.students) &&
      Array.isArray(saved.loans)
    ) {
      return saved;
    }
  } catch (error) {
    console.warn("Não foi possível ler os dados salvos.", error);
  }

  return emptyState();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  renderAll();
}

function uid() {
  return crypto?.randomUUID?.() ||
    `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function dateOnly(value) {
  if (!value) return null;

  const [y, m, d] = value.split("-").map(Number);

  return new Date(y, m - 1, d);
}

function todayISO() {
  const now = new Date();

  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
}

function formatDate(value) {
  if (!value) return "—";

  const date = dateOnly(value);

  return date ? date.toLocaleDateString("pt-BR") : "—";
}

function dayDifference(from, to) {
  return Math.floor(
    (dateOnly(to) - dateOnly(from)) / 86400000
  );
}

function bookById(id) {
  return state.books.find(item => item.id === id);
}

function studentById(id) {
  return state.students.find(item => item.id === id);
}

function activeLoansForBook(bookId) {
  return state.loans.filter(
    loan => loan.bookId === bookId && !loan.returnedAt
  ).length;
}

function availableCopies(book) {
  return Math.max(
    0,
    Number(book.quantity) - activeLoansForBook(book.id)
  );
}

function isOverdue(loan) {
  return !loan.returnedAt && loan.dueDate < todayISO();
}

function showToast(message) {
  const toast = $("#toast");

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2800);
}

function openModal(id) {
  const modal = document.getElementById(id);

  if (!modal) return;

  modal.classList.add("visible");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal(modal) {
  modal.classList.remove("visible");
  modal.setAttribute("aria-hidden", "true");
}

function navigate(screen) {
  const target = document.getElementById(`screen-${screen}`);

  if (!target) return;

  $$(".screen").forEach(item => {
    item.classList.remove("active");
  });

  target.classList.add("active");

  $$(".nav-link[data-screen]").forEach(item => {
    item.classList.toggle("active", item.dataset.screen === screen);
  });

  const labels = {
    inicio: "Visão geral",
    livros: "Acervo de livros",
    alunos: "Alunos",
    emprestimos: "Empréstimos",
    pendencias: "Pendências",
    relatorios: "Relatórios"
  };

  $("#breadcrumb-current").textContent =
    labels[screen] || "Visão geral";

  $("#sidebar").classList.remove("open");

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function statusBadge(loan) {
  if (loan.returnedAt) {
    return '<span class="badge success">Devolvido</span>';
  }

  if (isOverdue(loan)) {
    return '<span class="badge danger">Atrasado</span>';
  }

  return '<span class="badge warning">Em andamento</span>';
}

function emptyRow(columns, message) {
  return `
    <tr>
      <td colspan="${columns}" class="empty-cell">
        <span>▤</span>
        ${escapeHTML(message)}
      </td>
    </tr>
  `;
}

/* PAINEL INICIAL */

function renderDashboard() {
  const active = state.loans.filter(
    loan => !loan.returnedAt
  );

  const overdue = active.filter(isOverdue);

  $("#stat-books").textContent =
    state.books.reduce(
      (sum, book) => sum + Number(book.quantity || 0),
      0
    );

  $("#stat-students").textContent =
    state.students.length;

  $("#stat-loans").textContent =
    active.length;

  $("#stat-overdue").textContent =
    overdue.length;

  $("#nav-overdue").textContent =
    overdue.length;

  $("#attention-count").textContent =
    overdue.length;

  const recent = [...state.loans]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  $("#recent-loans").innerHTML = recent.length
    ? recent.map(loan => {
        const book = bookById(loan.bookId);
        const student = studentById(loan.studentId);

        return `
          <tr>
            <td><strong>${escapeHTML(book?.title || "Livro removido")}</strong></td>
            <td>${escapeHTML(student?.name || "Aluno removido")}</td>
            <td>${formatDate(loan.dueDate)}</td>
            <td>${statusBadge(loan)}</td>
          </tr>
        `;
      }).join("")
    : emptyRow(4, "Nenhum empréstimo registrado ainda.");

  $("#attention-list").innerHTML = overdue.length
    ? overdue.slice(0, 4).map(loan => {
        const student = studentById(loan.studentId);
        const book = bookById(loan.bookId);

        return `
          <div class="attention-item">
            <span class="attention-dot"></span>
            <div>
              <strong>${escapeHTML(student?.name || "Aluno")}</strong>
              <small>
                ${escapeHTML(book?.title || "Livro")} ·
                ${dayDifference(loan.dueDate, todayISO())}
                dia(s) de atraso
              </small>
            </div>
          </div>
        `;
      }).join("")
    : `
      <div class="all-clear">
        <span>✓</span>
        <strong>Nenhuma pendência!</strong>
        <small>Os empréstimos estão em dia.</small>
      </div>
    `;
}

/* LIVROS */

function renderBooks() {
  const query = ($("#book-search")?.value || "")
    .trim()
    .toLocaleLowerCase("pt-BR");

  const books = state.books.filter(book =>
    [
      book.title,
      book.author,
      book.category,
      book.code
    ].join(" ").toLocaleLowerCase("pt-BR").includes(query)
  );

  $("#book-count").textContent =
    `${books.length} ${books.length === 1 ? "livro" : "livros"}`;

  $("#books-table").innerHTML = books.length
    ? books.map(book => `
      <tr>
        <td>
          <div class="primary-cell">
            <span class="book-cover">▤</span>
            <span>
              <strong>${escapeHTML(book.title)}</strong>
              <small>${escapeHTML(book.code || "Sem código")}</small>
            </span>
          </div>
        </td>
        <td>${escapeHTML(book.author)}</td>
        <td>${escapeHTML(book.category || "—")}</td>
        <td>
          <span class="stock ${availableCopies(book) === 0 ? "out" : ""}">
            ${availableCopies(book)}
          </span>
        </td>
        <td>${Number(book.quantity)}</td>
        <td class="row-actions">
          <button class="small-action" data-edit-book="${book.id}">Editar</button>
          <button class="small-action danger-text" data-delete-book="${book.id}">Excluir</button>
        </td>
      </tr>
    `).join("")
    : emptyRow(
        6,
        query
          ? "Nenhum livro encontrado para essa busca."
          : "Cadastre o primeiro livro do acervo."
      );
}

/* ALUNOS */

function renderStudents() {
  const query = ($("#student-search")?.value || "")
    .trim()
    .toLocaleLowerCase("pt-BR");

  const students = state.students.filter(student =>
    [
      student.name,
      student.className,
      student.email,
      student.phone
    ].join(" ").toLocaleLowerCase("pt-BR").includes(query)
  );

  $("#student-count").textContent =
    `${students.length} ${students.length === 1 ? "aluno" : "alunos"}`;

  $("#students-table").innerHTML = students.length
    ? students.map(student => `
      <tr>
        <td>
          <div class="primary-cell">
            <span class="person-avatar">
              ${escapeHTML(student.name.trim().charAt(0).toUpperCase())}
            </span>
            <strong>${escapeHTML(student.name)}</strong>
          </div>
        </td>
        <td>${escapeHTML(student.className || "—")}</td>
        <td>${escapeHTML(student.email || "—")}</td>
        <td>${escapeHTML(student.phone || "—")}</td>
        <td class="row-actions">
          <button class="small-action" data-edit-student="${student.id}">Editar</button>
          <button class="small-action danger-text" data-delete-student="${student.id}">Excluir</button>
        </td>
      </tr>
    `).join("")
    : emptyRow(
        5,
        query
          ? "Nenhum aluno encontrado para essa busca."
          : "Cadastre o primeiro aluno."
      );
}

/* EMPRÉSTIMOS */

function renderLoans() {
  const query = ($("#loan-search")?.value || "")
    .trim()
    .toLocaleLowerCase("pt-BR");

  const filter = $("#loan-filter")?.value || "ativos";

  const loans = [...state.loans]
    .filter(loan => {
      const book = bookById(loan.bookId);
      const student = studentById(loan.studentId);

      const matchesQuery = [
        book?.title,
        student?.name
      ].join(" ").toLocaleLowerCase("pt-BR").includes(query);

      const matchesFilter =
        filter === "todos" ||
        (filter === "devolvidos" && !!loan.returnedAt) ||
        (filter === "atrasados" && isOverdue(loan)) ||
        (filter === "ativos" && !loan.returnedAt);

      return matchesQuery && matchesFilter;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  $("#loans-table").innerHTML = loans.length
    ? loans.map(loan => `
      <tr>
        <td>
          <strong>
            ${escapeHTML(bookById(loan.bookId)?.title || "Livro removido")}
          </strong>
        </td>
        <td>
          ${escapeHTML(studentById(loan.studentId)?.name || "Aluno removido")}
        </td>
        <td>${formatDate(loan.loanDate)}</td>
        <td>${formatDate(loan.dueDate)}</td>
        <td>${statusBadge(loan)}</td>
        <td class="row-actions">
          ${
            loan.returnedAt
              ? `<span class="muted tiny">Em ${formatDate(loan.returnedAt)}</span>`
              : `<button class="small-action" data-return-loan="${loan.id}">Registrar devolução</button>`
          }
        </td>
      </tr>
    `).join("")
    : emptyRow(6, "Nenhum empréstimo encontrado.");
}

/* PENDÊNCIAS */

function renderOverdue() {
  const overdue = state.loans
    .filter(isOverdue)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  $("#overdue-table").innerHTML = overdue.length
    ? overdue.map(loan => {
        const student = studentById(loan.studentId);
        const book = bookById(loan.bookId);

        const phone = (student?.phone || "").replace(/\D/g, "");

        const message = `Olá, ${student?.name || ""}! O livro "${book?.title || ""}" está com devolução prevista para ${formatDate(loan.dueDate)}. Por favor, entre em contato com a biblioteca para regularizar a devolução.`;

        const whatsapp = phone
          ? `https://wa.me/55${phone}?text=${encodeURIComponent(message)}`
          : "";

        return `
          <tr>
            <td><strong>${escapeHTML(book?.title || "Livro removido")}</strong></td>
            <td>${escapeHTML(student?.name || "Aluno removido")}</td>
            <td>${escapeHTML(student?.phone || "Não informado")}</td>
            <td>${formatDate(loan.dueDate)}</td>
            <td>
              <span class="badge danger">
                ${dayDifference(loan.dueDate, todayISO())} dia(s)
              </span>
            </td>
            <td>
              ${
                whatsapp
                  ? `<a class="small-action whatsapp-link" href="${whatsapp}" target="_blank" rel="noopener">Abrir WhatsApp ↗</a>`
                  : '<span class="muted tiny">Sem telefone</span>'
              }
            </td>
          </tr>
        `;
      }).join("")
    : emptyRow(6, "Nenhuma devolução atrasada. Tudo em dia!");
}

/* RELATÓRIOS */

function renderReports() {
  const returned = state.loans.filter(
    loan => loan.returnedAt
  ).length;

  $("#report-books").textContent =
    state.books.reduce(
      (sum, book) => sum + Number(book.quantity || 0),
      0
    );

  $("#report-students").textContent =
    state.students.length;

  $("#report-total-loans").textContent =
    state.loans.length;

  $("#report-returned").textContent =
    returned;

  const total = state.books.reduce(
    (sum, book) => sum + Number(book.quantity || 0),
    0
  );

  const borrowed = state.loans.filter(
    loan => !loan.returnedAt
  ).length;

  const available = Math.max(0, total - borrowed);

  const percent = value =>
    total ? Math.round(value / total * 100) : 0;

  $("#inventory-summary").innerHTML = [
    ["Disponíveis", available, "blue"],
    ["Emprestados", borrowed, "amber"]
  ].map(([label, value, color]) => `
    <div class="bar-row">
      <div><span>${label}</span><strong>${value}</strong></div>
      <div class="bar-track">
        <span class="bar-fill ${color}" style="width:${percent(value)}%"></span>
      </div>
    </div>
  `).join("");
}

/* OPÇÕES DOS FORMULÁRIOS */

function renderLoanOptions() {
  const bookSelect = $("#loan-book");
  const studentSelect = $("#loan-student");

  const previousBook = bookSelect.value;
  const previousStudent = studentSelect.value;

  const availableBooks = state.books.filter(
    book => availableCopies(book) > 0
  );

  bookSelect.innerHTML =
    '<option value="">Selecione um livro disponível</option>' +
    availableBooks.map(book => `
      <option value="${book.id}">
        ${escapeHTML(book.title)} (${availableCopies(book)} disponível(is))
      </option>
    `).join("");

  studentSelect.innerHTML =
    '<option value="">Selecione um aluno</option>' +
    state.students.map(student => `
      <option value="${student.id}">
        ${escapeHTML(student.name)}
      </option>
    `).join("");

  if (availableBooks.some(book => book.id === previousBook)) {
    bookSelect.value = previousBook;
  }

  if (state.students.some(student => student.id === previousStudent)) {
    studentSelect.value = previousStudent;
  }
}

function renderAll() {
  renderDashboard();
  renderBooks();
  renderStudents();
  renderLoans();
  renderOverdue();
  renderReports();
  renderLoanOptions();
}

/* EDIÇÃO DE CADASTROS */

function resetBookForm() {
  $("#book-form").reset();
  $("#book-id").value = "";
  $("#book-quantity").value = 1;
  $("#book-modal-title").textContent = "Cadastrar livro";
}

function resetStudentForm() {
  $("#student-form").reset();
  $("#student-id").value = "";
  $("#student-modal-title").textContent = "Cadastrar aluno";
}

function editBook(id) {
  const book = bookById(id);

  if (!book) return;

  $("#book-id").value = book.id;
  $("#book-title").value = book.title;
  $("#book-author").value = book.author;
  $("#book-category").value = book.category || "";
  $("#book-code").value = book.code || "";
  $("#book-quantity").value = book.quantity;

  $("#book-modal-title").textContent = "Editar livro";

  openModal("book-modal");
}

function editStudent(id) {
  const student = studentById(id);

  if (!student) return;

  $("#student-id").value = student.id;
  $("#student-name").value = student.name;
  $("#student-class").value = student.className || "";
  $("#student-phone").value = student.phone || "";
  $("#student-email").value = student.email || "";

  $("#student-modal-title").textContent = "Editar aluno";

  openModal("student-modal");
}

/* SALVAR LIVRO */

$("#book-form").addEventListener("submit", event => {
  event.preventDefault();

  const id = $("#book-id").value;

  const quantity = Number($("#book-quantity").value);

  const current = id ? bookById(id) : null;

  if (current && quantity < activeLoansForBook(id)) {
    return showToast(
      "A quantidade não pode ser menor que os exemplares emprestados."
    );
  }

  const book = {
    id: id || uid(),
    title: $("#book-title").value.trim(),
    author: $("#book-author").value.trim(),
    category: $("#book-category").value.trim(),
    code: $("#book-code").value.trim(),
    quantity
  };

  if (current) {
    Object.assign(current, book);
  } else {
    state.books.push(book);
  }

  saveState();

  closeModal($("#book-modal"));

  resetBookForm();

  showToast(
    current ? "Livro atualizado!" : "Livro cadastrado!"
  );
});

/* SALVAR ALUNO */

$("#student-form").addEventListener("submit", event => {
  event.preventDefault();

  const id = $("#student-id").value;

  const student = {
    id: id || uid(),
    name: $("#student-name").value.trim(),
    className: $("#student-class").value.trim(),
    phone: $("#student-phone").value.trim(),
    email: $("#student-email").value.trim()
  };

  const current = id ? studentById(id) : null;

  if (current) {
    Object.assign(current, student);
  } else {
    state.students.push(student);
  }

  saveState();

  closeModal($("#student-modal"));

  resetStudentForm();

  showToast(
    current ? "Aluno atualizado!" : "Aluno cadastrado!"
  );
});

/* SALVAR EMPRÉSTIMO */

$("#loan-form").addEventListener("submit", event => {
  event.preventDefault();

  const book = bookById($("#loan-book").value);

  const student = studentById($("#loan-student").value);

  const loanDate = $("#loan-date").value;

  const dueDate = $("#loan-due").value;

  if (!book || !student) {
    return showToast("Selecione um livro e um aluno.");
  }

  if (availableCopies(book) < 1) {
    return showToast("Não há exemplares disponíveis desse livro.");
  }

  if (dueDate < loanDate) {
    return showToast(
      "A devolução não pode ser anterior ao empréstimo."
    );
  }

  state.loans.push({
    id: uid(),
    bookId: book.id,
    studentId: student.id,
    loanDate,
    dueDate,
    returnedAt: null,
    createdAt: new Date().toISOString()
  });

  saveState();

  closeModal($("#loan-modal"));

  $("#loan-form").reset();

  setDefaultLoanDates();

  showToast("Empréstimo registrado com sucesso!");
});

/* DATAS AUTOMÁTICAS */

function setDefaultLoanDates() {
  const today = todayISO();

  const due = new Date();

  due.setDate(due.getDate() + 14);

  $("#loan-date").value = today;

  $("#loan-due").value =
    `${due.getFullYear()}-${String(due.getMonth()+1).padStart(2,"0")}-${String(due.getDate()).padStart(2,"0")}`;
}

/* DEVOLUÇÃO */

function returnLoan(id) {
  const loan = state.loans.find(
    item => item.id === id
  );

  if (!loan || loan.returnedAt) return;

  if (!confirm("Confirmar a devolução deste livro?")) {
    return;
  }

  loan.returnedAt = todayISO();

  saveState();

  showToast("Devolução registrada!");
}

/* EXCLUIR LIVRO */

function deleteBook(id) {
  const book = bookById(id);

  if (!book) return;

  if (activeLoansForBook(id)) {
    return showToast(
      "Este livro possui empréstimo ativo. Registre a devolução antes de excluir."
    );
  }

  if (!confirm(`Excluir o livro "${book.title}"?`)) {
    return;
  }

  state.books = state.books.filter(
    item => item.id !== id
  );

  saveState();

  showToast("Livro excluído.");
}

/* EXCLUIR ALUNO */

function deleteStudent(id) {
  const student = studentById(id);

  if (!student) return;

  if (
    state.loans.some(
      loan => loan.studentId === id && !loan.returnedAt
    )
  ) {
    return showToast(
      "Este aluno possui empréstimo ativo e não pode ser excluído."
    );
  }

  if (!confirm(`Excluir o cadastro de "${student.name}"?`)) {
    return;
  }

  state.students = state.students.filter(
    item => item.id !== id
  );

  saveState();

  showToast("Aluno excluído.");
}

/* CLIQUES E NAVEGAÇÃO */

document.addEventListener("click", event => {
  const nav = event.target.closest("[data-screen]");

  if (nav) {
    event.preventDefault();
    navigate(nav.dataset.screen);
  }

  const go = event.target.closest("[data-go]");

  if (go) {
    navigate(go.dataset.go);
  }

  const opener = event.target.closest("[data-open-modal]");

  if (opener) {
    if (opener.dataset.openModal === "book-modal") {
      resetBookForm();
    }

    if (opener.dataset.openModal === "student-modal") {
      resetStudentForm();
    }

    if (opener.dataset.openModal === "loan-modal") {
      renderLoanOptions();
      setDefaultLoanDates();
    }

    openModal(opener.dataset.openModal);
  }

  const closer = event.target.closest("[data-close-modal]");

  if (closer) {
    closeModal(closer.closest(".modal-backdrop"));
  }

  const backdrop = event.target.classList.contains("modal-backdrop")
    ? event.target
    : null;

  if (backdrop) {
    closeModal(backdrop);
  }

  const editB = event.target.closest("[data-edit-book]");

  if (editB) {
    editBook(editB.dataset.editBook);
  }

  const delB = event.target.closest("[data-delete-book]");

  if (delB) {
    deleteBook(delB.dataset.deleteBook);
  }

  const editS = event.target.closest("[data-edit-student]");

  if (editS) {
    editStudent(editS.dataset.editStudent);
  }

  const delS = event.target.closest("[data-delete-student]");

  if (delS) {
    deleteStudent(delS.dataset.deleteStudent);
  }

  const returned = event.target.closest("[data-return-loan]");

  if (returned) {
    returnLoan(returned.dataset.returnLoan);
  }
});

/* PESQUISAS E FILTROS */

[
  "book-search",
  "student-search",
  "loan-search",
  "loan-filter"
].forEach(id => {
  document.getElementById(id).addEventListener(
    "input",
    renderAll
  );
});

/* MENU PARA CELULAR */

$("#mobile-menu").addEventListener("click", () => {
  $("#sidebar").classList.toggle("open");
});

/* EXPORTAR BACKUP */

$("#backup-button").addEventListener("click", () => {
  const blob = new Blob(
    [JSON.stringify(state, null, 2)],
    { type: "application/json" }
  );

  downloadBlob(
    blob,
    `backup-bibliogestao-${todayISO()}.json`
  );

  showToast("Backup exportado.");
});

/* IMPORTAR BACKUP */

$("#backup-input").addEventListener("change", async event => {
  const file = event.target.files[0];

  if (!file) return;

  try {
    const data = JSON.parse(await file.text());

    if (
      !data ||
      !Array.isArray(data.books) ||
      !Array.isArray(data.students) ||
      !Array.isArray(data.loans)
    ) {
      throw new Error("Formato inválido");
    }

    if (
      !confirm(
        "Importar este backup substituirá os dados atuais deste navegador. Deseja continuar?"
      )
    ) {
      return;
    }

    state.books = data.books;
    state.students = data.students;
    state.loans = data.loans;

    saveState();

    showToast("Backup importado com sucesso!");

  } catch (error) {
    showToast(
      "Não foi possível importar. Verifique o arquivo de backup."
    );
  }

  event.target.value = "";
});

/* DOWNLOAD DE ARQUIVOS */

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);

  link.click();

  link.remove();

  URL.revokeObjectURL(url);
}

/* EXPORTAR RELATÓRIO CSV */

$("#export-report").addEventListener("click", () => {
  const rows = [[
    "Livro",
    "Aluno",
    "Turma",
    "Data do empréstimo",
    "Prazo de devolução",
    "Data da devolução",
    "Situação"
  ]];

  state.loans.forEach(loan => {
    const book = bookById(loan.bookId);

    const student = studentById(loan.studentId);

    rows.push([
      book?.title || "",
      student?.name || "",
      student?.className || "",
      loan.loanDate,
      loan.dueDate,
      loan.returnedAt || "",
      loan.returnedAt
        ? "Devolvido"
        : isOverdue(loan)
          ? "Atrasado"
          : "Em andamento"
    ]);
  });

  const csv =
    "\uFEFF" +
    rows.map(row =>
      row.map(value =>
        `"${String(value).replace(/"/g, '""')}"`
      ).join(";")
    ).join("\r\n");

  downloadBlob(
    new Blob([csv], {
      type: "text/csv;charset=utf-8"
    }),
    `relatorio-bibliogestao-${todayISO()}.csv`
  );

  showToast("Relatório CSV exportado.");
});

/* INICIALIZAÇÃO */

$("#today-label").textContent =
  new Date().toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric"
  });

setDefaultLoanDates();

renderAll();