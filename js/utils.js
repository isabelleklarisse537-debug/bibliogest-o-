/*
 * Bibliogestão — utilitários compartilhados.
 * Funções puras de normalização, datas, telefone, WhatsApp e formatação.
 */
(function () {
  "use strict";

  const BG = (window.BG = window.BG || {});

  /** Remove acentos, espaços e pontuação; usado para comparar nomes. */
  function normalize(value) {
    return String(value == null ? "" : value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }

  /** Normaliza texto para busca, preservando espaços simples. */
  function normalizeSearch(value) {
    return String(value == null ? "" : value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function cleanText(value) {
    if (value == null) return "";
    if (value instanceof Uint8Array) return "[binário]";
    return String(value).replace(/\s+/g, " ").trim();
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function today() {
    return startOfDay(new Date());
  }

  function validDate(year, month, day) {
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }
    return date;
  }

  /**
   * Lê datas em dd/mm/aaaa, dd-mm-aaaa, aaaa-mm-dd e ISO.
   * Também aceita número de série do Excel.
   */
  function parseDate(value) {
    if (value == null || value === "") return null;

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : startOfDay(value);
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      if (value > 20000 && value < 90000) {
        const base = Date.UTC(1899, 11, 30);
        const date = new Date(base + Math.round(value) * 86400000);
        return validDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
      }
      return null;
    }

    const text = String(value).trim();
    if (!text) return null;

    let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (match) {
      return validDate(Number(match[1]), Number(match[2]), Number(match[3]));
    }

    match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
    if (match) {
      let year = Number(match[3]);
      if (year < 100) year += year >= 70 ? 1900 : 2000;
      return validDate(year, Number(match[2]), Number(match[1]));
    }

    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : startOfDay(parsed);
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function formatDate(value) {
    const date = value instanceof Date ? value : parseDate(value);
    if (!date) return "—";
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
  }

  function formatDateTime(value) {
    const date = value instanceof Date ? value : parseDate(value);
    if (!date) return "—";
    return `${formatDate(date)}`;
  }

  /** Diferença em dias de calendário (to - from). */
  function daysBetween(from, to) {
    const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
    const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
    return Math.round((b - a) / 86400000);
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("pt-BR").format(Number(value) || 0);
  }

  function formatPercent(value) {
    return `${new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(Number(value) || 0)}%`;
  }

  /**
   * Situação calculada de um empréstimo.
   * Devolvido > Atrasado > Vence hoje > Em andamento > Sem data.
   */
  function loanStatus(loan, referenceDate) {
    const reference = referenceDate || today();

    if (loan.returnDate) {
      return { key: "returned", label: "Devolvido", tone: "success", days: 0 };
    }

    if (!loan.dueDate) {
      return { key: "unknown", label: "Sem data", tone: "neutral", days: 0 };
    }

    const difference = daysBetween(reference, loan.dueDate);

    if (difference < 0) {
      return {
        key: "overdue",
        label: "Atrasado",
        tone: "danger",
        days: Math.abs(difference)
      };
    }

    if (difference === 0) {
      return { key: "dueToday", label: "Vence hoje", tone: "warning", days: 0 };
    }

    return {
      key: "active",
      label: "Em andamento",
      tone: "info",
      days: difference
    };
  }

  function isActiveLoan(loan) {
    return !loan.returnDate;
  }

  /** Traduz a situação cadastrada do item para um rótulo amigável. */
  function itemStatusLabel(rawStatus, hasActiveLoan) {
    if (hasActiveLoan) return "Emprestado";

    const key = normalize(rawStatus);
    if (!key) return "Não informado";

    if (["n", "d", "disp", "disponivel", "normal", "ativo", "a"].includes(key)) {
      return "Disponível";
    }
    if (["e", "emp", "emprestado", "indisponivel"].includes(key)) {
      return "Emprestado";
    }
    if (["b", "baixado", "baixa", "excluido", "inativo"].includes(key)) {
      return "Baixado";
    }
    if (["r", "reservado", "reserva"].includes(key)) {
      return "Reservado";
    }
    if (["m", "manutencao", "reparo"].includes(key)) {
      return "Em manutenção";
    }

    return cleanText(rawStatus) || "Não informado";
  }

  function itemStatusKey(rawStatus, hasActiveLoan) {
    if (hasActiveLoan) return "borrowed";
    const key = normalize(rawStatus);
    if (["n", "d", "disp", "disponivel", "normal", "ativo", "a"].includes(key)) {
      return "available";
    }
    if (["e", "emp", "emprestado", "indisponivel"].includes(key)) {
      return "borrowed";
    }
    if (["b", "baixado", "baixa", "excluido", "inativo"].includes(key)) {
      return "discarded";
    }
    if (["r", "reservado", "reserva"].includes(key)) return "reserved";
    if (["m", "manutencao", "reparo"].includes(key)) return "maintenance";
    return "unknown";
  }

  function readerStatusLabel(rawStatus) {
    const key = normalize(rawStatus);
    if (!key) return "Não informado";
    if (["s", "a", "ativo", "active", "1"].includes(key)) return "Ativo";
    if (["n", "i", "inativo", "inactive", "0"].includes(key)) return "Inativo";
    return cleanText(rawStatus);
  }

  function readerIsActive(rawStatus) {
    const key = normalize(rawStatus);
    if (!key) return true;
    return ["s", "a", "ativo", "active", "1"].includes(key);
  }

  function phoneDigits(value) {
    return String(value == null ? "" : value).replace(/\D/g, "");
  }

  function formatPhone(value) {
    const digits = phoneDigits(value);
    if (!digits) return "—";
    if (digits.length === 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return cleanText(value);
  }

  function whatsappNumber(value) {
    let digits = phoneDigits(value);
    if (!digits) return null;
    digits = digits.replace(/^0+/, "");
    if (digits.length === 10 || digits.length === 11) return `55${digits}`;
    if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
      return digits;
    }
    return null;
  }

  function whatsappLink(phone, message) {
    const number = whatsappNumber(phone);
    if (!number) return null;
    const text = message ? `?text=${encodeURIComponent(message)}` : "";
    return `https://wa.me/${number}${text}`;
  }

  function debounce(fn, delay) {
    let timer = null;
    return function debounced(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function sum(list, selector) {
    return list.reduce((total, item) => total + Number(selector(item) || 0), 0);
  }

  function groupCount(list, selector) {
    const map = new Map();
    list.forEach(item => {
      const key = selector(item) || "Não informado";
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"));
  }

  function sortByCountDescending(a, b) {
    return b.count - a.count || a.label.localeCompare(b.label, "pt-BR");
  }

  BG.utils = {
    normalize,
    normalizeSearch,
    cleanText,
    escapeHtml,
    startOfDay,
    today,
    parseDate,
    formatDate,
    formatDateTime,
    daysBetween,
    formatNumber,
    formatPercent,
    loanStatus,
    isActiveLoan,
    itemStatusLabel,
    itemStatusKey,
    readerStatusLabel,
    readerIsActive,
    phoneDigits,
    formatPhone,
    whatsappNumber,
    whatsappLink,
    debounce,
    sum,
    groupCount,
    sortByCountDescending
  };
})();
