/*
 * Bibliogestão — cálculos derivados dos dados importados.
 * Centraliza a situação dos empréstimos, vínculos e indicadores usados
 * pelas telas e pelos relatórios.
 */
(function () {
  "use strict";

  const BG = (window.BG = window.BG || {});
  const utils = BG.utils;

  const STATUS_ORDER = ["active", "dueToday", "overdue", "returned", "unknown"];

  function loanView(loan, index, referenceDate) {
    const status = utils.loanStatus(loan, referenceDate);
    return {
      ...loan,
      index,
      status,
      bookTitle: loan.book?.title || (loan.bookCode ? `Tombo ${loan.bookCode}` : "Livro não identificado"),
      bookAuthor: loan.book?.author || "",
      bookCode: loan.book?.code || loan.bookCode || "",
      readerName: loan.reader?.name || (loan.readerRegistration ? `Matrícula ${loan.readerRegistration}` : "Aluno não identificado"),
      readerRegistration: loan.reader?.registration || loan.readerRegistration || "",
      className: loan.reader?.className || "",
      readerPhone: loan.reader?.phone || "",
      librarianName: loan.librarian?.name || "",
      librarianRegistration: loan.librarian?.registration || loan.librarianRegistration || ""
    };
  }

  function dateValue(date) {
    return date instanceof Date ? date.getTime() : 0;
  }

  function sortRecent(a, b) {
    const byDate = dateValue(b.loanDate) - dateValue(a.loanDate);
    if (byDate !== 0) return byDate;
    return b.index - a.index;
  }

  function sortMostOverdue(a, b) {
    if (b.status.days !== a.status.days) return b.status.days - a.status.days;
    return dateValue(a.dueDate) - dateValue(b.dueDate);
  }

  function increment(map, key) {
    if (!key) return;
    map.set(key, (map.get(key) || 0) + 1);
  }

  function compute(dataset, referenceDate) {
    const reference = referenceDate || utils.today();
    const loans = dataset.loans.map((loan, index) =>
      loanView(loan, index, reference)
    );

    const activeLoans = loans.filter(loan => !loan.returnDate);
    const overdueLoans = activeLoans.filter(
      loan => loan.status.key === "overdue"
    );
    const dueTodayLoans = activeLoans.filter(
      loan => loan.status.key === "dueToday"
    );
    const returnedLoans = loans.filter(loan => Boolean(loan.returnDate));
    const unknownLoans = activeLoans.filter(
      loan => loan.status.key === "unknown"
    );

    const activeByBook = new Map();
    activeLoans.forEach(loan => {
      if (loan.bookCode) activeByBook.set(loan.bookCode, loan);
    });

    const activeByReader = new Map();
    const overdueByReader = new Map();
    activeLoans.forEach(loan => {
      increment(activeByReader, loan.readerRegistration || loan.readerName);
    });
    overdueLoans.forEach(loan => {
      increment(overdueByReader, loan.readerRegistration || loan.readerName);
    });

    const availableBooks = dataset.books.filter(
      book => !activeByBook.has(book.code)
    );

    const statusCounts = STATUS_ORDER.map(key => {
      const map = {
        active: activeLoans.filter(loan => loan.status.key === "active"),
        dueToday: dueTodayLoans,
        overdue: overdueLoans,
        returned: returnedLoans,
        unknown: unknownLoans
      };
      const labels = {
        active: "Em andamento",
        dueToday: "Vence hoje",
        overdue: "Atrasado",
        returned: "Devolvido",
        unknown: "Sem data"
      };
      return { key, label: labels[key], count: map[key].length };
    });

    const activeReaders = dataset.readers.filter(reader =>
      utils.readerIsActive(reader.status)
    ).length;

    return {
      referenceDate: reference,
      loans,
      activeLoans,
      overdueLoans,
      dueTodayLoans,
      returnedLoans,
      unknownLoans,
      activeByBook,
      activeByReader,
      overdueByReader,
      availableBooks,
      statusCounts,
      recentLoans: loans.slice().sort(sortRecent),
      pendingLoans: overdueLoans.slice().sort(sortMostOverdue),
      metrics: {
        books: dataset.books.length,
        readers: dataset.readers.length,
        activeReaders,
        librarians: dataset.librarians.length,
        loans: loans.length,
        activeLoans: activeLoans.length,
        overdueLoans: overdueLoans.length,
        dueTodayLoans: dueTodayLoans.length,
        returnedLoans: returnedLoans.length,
        availableBooks: availableBooks.length,
        readersWithPending: overdueByReader.size
      }
    };
  }

  BG.analytics = {
    STATUS_ORDER,
    compute,
    sortRecent,
    sortMostOverdue
  };
})();
