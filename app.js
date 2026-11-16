const MONEY_FORMATTER = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 0,
});

const DEPENDENT_DEDUCTION = 6200000;
const PERSONAL_DEDUCTION_2026 = 15500000;

const SUPABASE_URL = "https://pjjizawertphihdkmngp.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Nio0HyBxHPsZbN-CfGzatA_SFO4ykHy";
const supabaseClient = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;

const taxBrackets = [
  { from: 0, to: 10000000, rate: 0.05, label: "Bậc 1 - 5%" },
  { from: 10000000, to: 30000000, rate: 0.1, label: "Bậc 2 - 10%" },
  { from: 30000000, to: 60000000, rate: 0.2, label: "Bậc 3 - 20%" },
  { from: 60000000, to: 100000000, rate: 0.3, label: "Bậc 4 - 30%" },
  { from: 100000000, to: Infinity, rate: 0.35, label: "Bậc 5 - 35%" },
];

const otCoefficients = {
  weekday: { day: 1.5, night: 2.1 },
  sunday: { day: 2, night: 2.7 },
  holiday: { day: 3, night: 3.9 },
};

const elements = {
  accountBadge: document.getElementById("accountBadge"),
  btnLogin: document.getElementById("btnLogin"),
  btnLogout: document.getElementById("btnLogout"),

  baseSalary: document.getElementById("baseSalary"),
  otSalary: document.getElementById("otSalary"),
  xjobSalary: document.getElementById("xjobSalary"),
  mscSalary: document.getElementById("mscSalary"),
  allowance: document.getElementById("allowance"),
  preTaxSalary: document.getElementById("preTaxSalary"),
  preTaxSalaryPanel: document.getElementById("preTaxSalaryPanel"),

  otRowsContainer: document.getElementById("otRowsContainer"),
  addOtRowBtn: document.getElementById("addOtRowBtn"),
  totalOtAmount: document.getElementById("totalOtAmount"),
  totalOtAmountPanel: document.getElementById("totalOtAmountPanel"),

  personalDeduction: document.getElementById("personalDeduction"),
  dependents: document.getElementById("dependents"),
  insurance: document.getElementById("insurance"),
  familyDeduction: document.getElementById("familyDeduction"),
  totalDeduction: document.getElementById("totalDeduction"),
  taxableIncome: document.getElementById("taxableIncome"),
  taxDue: document.getElementById("taxDue"),
  taxBracketLabel: document.getElementById("taxBracketLabel"),

  utopAdvance: document.getElementById("utopAdvance"),
  unionFee: document.getElementById("unionFee"),
  latePenalty: document.getElementById("latePenalty"),
  netIncome: document.getElementById("netIncome"),
  netIncomePanel: document.getElementById("netIncomePanel"),

  calculateBtn: document.getElementById("calculateBtn"),
  resetBtn: document.getElementById("resetBtn"),
  historyNotice: document.getElementById("historyNotice"),
  historyList: document.getElementById("historyList"),

  loginModal: document.getElementById("loginModal"),
  loginEmail: document.getElementById("loginEmail"),
  loginPassword: document.getElementById("loginPassword"),
  registerDisplayName: document.getElementById("registerDisplayName"),
  registerConfirmPassword: document.getElementById("registerConfirmPassword"),
  displayNameField: document.getElementById("displayNameField"),
  confirmPasswordField: document.getElementById("confirmPasswordField"),
  authStatus: document.getElementById("authStatus"),
  loginModeBtn: document.getElementById("loginModeBtn"),
  registerModeBtn: document.getElementById("registerModeBtn"),
  loginSubmit: document.getElementById("loginSubmit"),
  loginCancel: document.getElementById("loginCancel"),
};

const money = (value) => `${MONEY_FORMATTER.format(Math.max(0, Math.round(value || 0)))} đ`;
const formatInputMoney = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "0";
  return MONEY_FORMATTER.format(Number(digits));
};
const parseMoneyInput = (value) => Number(String(value || "").replace(/\D/g, "")) || 0;
const num = (element) => {
  if (element.classList.contains("money-input")) {
    return Math.max(0, parseMoneyInput(element.value));
  }
  return Math.max(0, Number(element.value) || 0);
};

const setMoneyInputValue = (element, value) => {
  element.value = formatInputMoney(value);
};

const normalizeMoneyInput = (element) => {
  const raw = element.value;
  const cursor = element.selectionStart || raw.length;
  const digitsBeforeCursor = raw.slice(0, cursor).replace(/\D/g, "").length;
  const formatted = formatInputMoney(raw);
  element.value = formatted;

  let nextCursor = formatted.length;
  if (digitsBeforeCursor > 0) {
    let digitCount = 0;
    nextCursor = formatted.length;
    for (let index = 0; index < formatted.length; index += 1) {
      if (/\d/.test(formatted[index])) digitCount += 1;
      if (digitCount >= digitsBeforeCursor) {
        nextCursor = index + 1;
        break;
      }
    }
  }

  element.setSelectionRange(nextCursor, nextCursor);
};

const isEditableNumberInput = (element) => {
  if (!(element instanceof HTMLInputElement)) return false;
  if (element.closest(".modal")) return false;
  return element.classList.contains("money-input") || element.type === "number";
};

const clearDefaultZero = (element) => {
  if (!isEditableNumberInput(element)) return;
  if (element.value === "0") {
    element.value = "";
  }
};

const restoreEmptyNumber = (element) => {
  if (!isEditableNumberInput(element)) return;
  if (element.value.trim() !== "") return;
  element.value = "0";
  if (element.classList.contains("money-input")) {
    normalizeMoneyInput(element);
  }
  renderCalculatedValues();
};

const session = {
  userId: "",
  user: "",
  displayName: "",
};

let authMode = "login";
let nextOtRowId = 1;
let otRows = [];
let historyItems = [];
let isSavingHistory = false;

const normalizeUsername = (username) => String(username || "").trim().toLowerCase();

const toAuthEmail = (identifier) => {
  const normalized = normalizeUsername(identifier);
  if (!normalized) return "";
  return normalized.includes("@") ? normalized : `${normalized}@salarycalculator.local`;
};

const getLegacyLocalHistory = (username) => {
  if (!username) return [];
  try {
    return JSON.parse(localStorage.getItem(`salaryCalculator.history.${username}`) || "[]");
  } catch {
    return [];
  }
};

const clearLegacyLocalHistory = (username) => {
  if (!username) return;
  localStorage.removeItem(`salaryCalculator.history.${username}`);
};

const mapDbRowToHistoryItem = (row) => ({
  id: row.id,
  createdAt: new Date(row.created_at).toLocaleString("vi-VN"),
  preTaxSalary: Number(row.pre_tax_salary) || 0,
  otTotal: Number(row.ot_total) || 0,
  taxableIncome: Number(row.taxable_income) || 0,
  taxDue: Number(row.tax_due) || 0,
  insurance: Number(row.insurance) || 0,
  netIncome: Number(row.net_income) || 0,
  inputs: row.inputs || {},
});

const calcPreTaxSalary = () =>
  num(elements.baseSalary) + num(elements.xjobSalary) + num(elements.mscSalary) + num(elements.allowance);

const createOtRow = () => ({
  id: nextOtRowId,
  hours: 0,
  dayType: "weekday",
  shift: "day",
});

const getOtCoefficient = (dayType, shift) => otCoefficients[dayType][shift];

const syncOtRowsFromDom = () => {
  otRows = Array.from(elements.otRowsContainer.querySelectorAll(".ot-row")).map((row) => ({
    id: Number(row.dataset.otRow),
    hours: num(row.querySelector("[data-ot-field='hours']")),
    dayType: row.querySelector("[data-ot-field='dayType']").value,
    shift: row.querySelector("[data-ot-field='shift']").value,
  }));
};

const renderOtRows = () => {
  elements.otRowsContainer.innerHTML = otRows
    .map((row, index) => {
      const coefficient = getOtCoefficient(row.dayType, row.shift);
      return `
        <div class="ot-row" data-ot-row="${row.id}">
          <div class="ot-cell" data-label="Giờ">
            <input id="ot${row.id}Hours" data-ot-field="hours" type="number" inputmode="decimal" min="0" step="0.5" value="${row.hours}" aria-label="Số giờ OT ${index + 1}" />
          </div>
          <div class="ot-cell" data-label="Loại ngày">
            <select data-ot-field="dayType" aria-label="Loại ngày OT ${index + 1}">
              <option value="weekday" ${row.dayType === "weekday" ? "selected" : ""}>Ngày thường</option>
              <option value="sunday" ${row.dayType === "sunday" ? "selected" : ""}>Chủ nhật</option>
              <option value="holiday" ${row.dayType === "holiday" ? "selected" : ""}>Ngày lễ</option>
            </select>
          </div>
          <div class="ot-cell" data-label="Ca">
            <select data-ot-field="shift" aria-label="Ca OT ${index + 1}">
              <option value="day" ${row.shift === "day" ? "selected" : ""}>Ngày</option>
              <option value="night" ${row.shift === "night" ? "selected" : ""}>Đêm</option>
            </select>
          </div>
          <div class="ot-cell" data-label="Hệ số">
            <strong data-ot-output="coefficient">${Math.round(coefficient * 100)}%</strong>
          </div>
          <div class="ot-cell" data-label="Tiền OT">
            <strong data-ot-output="amount">0 đ</strong>
          </div>
          <div class="ot-cell ot-action-cell" data-label="Xóa">
            <button class="icon-btn delete-ot-row" type="button" data-action="delete-ot-row" aria-label="Xóa dòng OT ${index + 1}">×</button>
          </div>
        </div>
      `;
    })
    .join("");
};

const calcOtLine = (rowElement) => {
  const otSalary = num(elements.otSalary);
  const hourlyBase = otSalary / 22 / 8;
  const hourInput = rowElement.querySelector("[data-ot-field='hours']");
  const dayTypeInput = rowElement.querySelector("[data-ot-field='dayType']");
  const shiftInput = rowElement.querySelector("[data-ot-field='shift']");
  const coefficientEl = rowElement.querySelector("[data-ot-output='coefficient']");
  const amountEl = rowElement.querySelector("[data-ot-output='amount']");
  const hours = num(hourInput);
  const dayType = dayTypeInput.value;
  const shift = shiftInput.value;
  const coefficient = getOtCoefficient(dayType, shift);
  const amount = hourlyBase * coefficient * hours;

  coefficientEl.textContent = `${Math.round(coefficient * 100)}%`;
  amountEl.textContent = money(amount);

  return {
    hours,
    dayType,
    shift,
    coefficient,
    amount,
  };
};

const calcOt = () => {
  const lines = Array.from(elements.otRowsContainer.querySelectorAll(".ot-row")).reduce((result, rowElement) => {
    result[`ot${rowElement.dataset.otRow}`] = calcOtLine(rowElement);
    return result;
  }, {});
  const total = Object.values(lines).reduce((sum, line) => sum + line.amount, 0);

  return {
    lines,
    total,
  };
};

const calcTax = (taxableIncome) => {
  let due = 0;

  taxBrackets.forEach((bracket) => {
    if (taxableIncome <= bracket.from) return;
    const taxableSegment = Math.min(taxableIncome, bracket.to) - bracket.from;
    due += taxableSegment * bracket.rate;
  });

  const activeBracket = taxBrackets.find(
    (bracket) => taxableIncome > bracket.from && taxableIncome <= bracket.to
  );

  return {
    due,
    label: activeBracket ? activeBracket.label : "Không phát sinh thuế",
  };
};

const calculateSnapshot = () => {
  const preTaxSalary = calcPreTaxSalary();
  const ot = calcOt();
  const personalDeduction = num(elements.personalDeduction);
  const dependents = Math.floor(num(elements.dependents));
  const familyDeduction = dependents * DEPENDENT_DEDUCTION;
  const insurance = num(elements.insurance);

  // BHXH là khoản được trừ khi tính thuế TNCN, đồng thời vẫn bị trừ khỏi thực nhận.
  const totalDeduction = personalDeduction + familyDeduction + insurance;
  const taxableIncome = Math.max(0, preTaxSalary - totalDeduction);
  const tax = calcTax(taxableIncome);
  const utopAdvance = num(elements.utopAdvance);
  const unionFee = num(elements.unionFee);
  const latePenalty = num(elements.latePenalty);
  const netIncome =
    preTaxSalary - insurance - tax.due - utopAdvance - unionFee - latePenalty + ot.total;

  return {
    preTaxSalary,
    ot,
    personalDeduction,
    dependents,
    familyDeduction,
    insurance,
    totalDeduction,
    taxableIncome,
    taxDue: tax.due,
    taxBracketLabel: tax.label,
    utopAdvance,
    unionFee,
    latePenalty,
    netIncome,
  };
};

const renderCalculatedValues = () => {
  syncOtRowsFromDom();
  const data = calculateSnapshot();

  elements.preTaxSalary.textContent = money(data.preTaxSalary);
  elements.preTaxSalaryPanel.textContent = money(data.preTaxSalary);
  elements.totalOtAmount.textContent = money(data.ot.total);
  elements.totalOtAmountPanel.textContent = money(data.ot.total);
  elements.familyDeduction.textContent = money(data.familyDeduction);
  elements.totalDeduction.textContent = money(data.totalDeduction);
  elements.taxableIncome.textContent = money(data.taxableIncome);
  elements.taxDue.textContent = money(data.taxDue);
  elements.taxBracketLabel.textContent = data.taxBracketLabel;
  elements.netIncome.textContent = money(data.netIncome);
  elements.netIncomePanel.textContent = money(data.netIncome);

  return data;
};

const collectInputs = (data) => ({
  salary: {
    baseSalary: num(elements.baseSalary),
    otSalary: num(elements.otSalary),
    xjobSalary: num(elements.xjobSalary),
    mscSalary: num(elements.mscSalary),
    allowance: num(elements.allowance),
  },
  otRows: otRows.map((row) => ({
    hours: row.hours,
    dayType: row.dayType,
    shift: row.shift,
  })),
  tax: {
    personalDeduction: data.personalDeduction,
    dependents: data.dependents,
    insurance: data.insurance,
  },
  net: {
    utopAdvance: data.utopAdvance,
    unionFee: data.unionFee,
    latePenalty: data.latePenalty,
  },
});

const getEntryInputs = (entry) => {
  if (entry.inputs?.salary) {
    return {
      ...entry.inputs,
      salary: {
        ...entry.inputs.salary,
        otSalary: entry.inputs.salary.otSalary ?? entry.inputs.salary.baseSalary ?? 0,
      },
    };
  }

  return {
    salary: {
      baseSalary: entry.inputs?.baseSalary || 0,
      otSalary: entry.inputs?.otSalary ?? entry.inputs?.baseSalary ?? 0,
      xjobSalary: entry.inputs?.xjobSalary || 0,
      mscSalary: entry.inputs?.mscSalary || 0,
      allowance: entry.inputs?.allowance || 0,
    },
    otRows: [{ hours: 0, dayType: "weekday", shift: "day" }],
    tax: {
      personalDeduction: entry.inputs?.personalDeduction || PERSONAL_DEDUCTION_2026,
      dependents: entry.inputs?.dependents || 0,
      insurance: entry.insurance || 0,
    },
    net: {
      utopAdvance: 0,
      unionFee: 0,
      latePenalty: 0,
    },
  };
};

const applyHistoryEntry = (entry) => {
  const inputs = getEntryInputs(entry);

  setMoneyInputValue(elements.baseSalary, inputs.salary.baseSalary);
  setMoneyInputValue(elements.otSalary, inputs.salary.otSalary);
  setMoneyInputValue(elements.xjobSalary, inputs.salary.xjobSalary);
  setMoneyInputValue(elements.mscSalary, inputs.salary.mscSalary);
  setMoneyInputValue(elements.allowance, inputs.salary.allowance);

  nextOtRowId = 1;
  otRows = (inputs.otRows?.length ? inputs.otRows : [{ hours: 0, dayType: "weekday", shift: "day" }]).map((row) => {
    const newRow = {
      id: nextOtRowId,
      hours: Number(row.hours) || 0,
      dayType: row.dayType || "weekday",
      shift: row.shift || "day",
    };
    nextOtRowId += 1;
    return newRow;
  });
  renderOtRows();

  setMoneyInputValue(elements.personalDeduction, inputs.tax.personalDeduction);
  elements.dependents.value = inputs.tax.dependents || 0;
  setMoneyInputValue(elements.insurance, inputs.tax.insurance);
  setMoneyInputValue(elements.utopAdvance, inputs.net.utopAdvance);
  setMoneyInputValue(elements.unionFee, inputs.net.unionFee);
  setMoneyInputValue(elements.latePenalty, inputs.net.latePenalty);

  renderCalculatedValues();
  window.scrollTo({ top: 0, behavior: "smooth" });
};

const renderAccount = () => {
  if (session.userId) {
    elements.accountBadge.textContent = session.displayName || session.user;
    elements.btnLogin.textContent = "Đổi tài khoản";
    if (elements.btnLogout) {
      elements.btnLogout.classList.remove("hidden");
      elements.btnLogout.hidden = false;
    }
  } else {
    elements.accountBadge.textContent = "Chưa đăng nhập";
    elements.btnLogin.textContent = "Đăng nhập";
    if (elements.btnLogout) {
      elements.btnLogout.classList.add("hidden");
      elements.btnLogout.hidden = true;
    }
  }
};

const renderHistory = (loadingMessage = "") => {
  if (!session.userId) {
    elements.historyNotice.textContent = "Đăng nhập để lưu và xem lịch sử tính lương trên mọi thiết bị.";
    elements.historyList.innerHTML = "";
    return;
  }

  if (loadingMessage) {
    elements.historyNotice.textContent = loadingMessage;
    return;
  }

  const labelName = session.displayName || session.user;
  elements.historyNotice.textContent = historyItems.length
    ? `Đang hiển thị ${historyItems.length} bản ghi của ${labelName} (đồng bộ đám mây).`
    : "Chưa có lịch sử. Bấm Tính / Lưu để tạo bản ghi đầu tiên.";

  elements.historyList.innerHTML = historyItems
    .map((item, index) => {
      const inputs = getEntryInputs(item);
      const otLineCount = inputs.otRows?.filter((row) => Number(row.hours) > 0).length || 0;
      return `
        <article class="history-item" data-index="${index}" data-id="${item.id}" data-action="reuse">
          <header>
            <div>
              <h3>${item.createdAt}</h3>
              <p>Thực nhận: <strong>${money(item.netIncome)}</strong></p>
            </div>
            <div class="history-actions">
              <button class="btn-use-history" type="button" data-action="reuse">Dùng lại</button>
              <button type="button" data-action="delete">Xóa</button>
            </div>
          </header>
          <dl>
            <div><dt>Lương trước thuế</dt><dd>${money(item.preTaxSalary)}</dd></div>
            <div><dt>OT</dt><dd>${money(item.otTotal)}</dd></div>
            <div><dt>Thuế</dt><dd>${money(item.taxDue)}</dd></div>
            <div><dt>BHXH</dt><dd>${money(item.insurance)}</dd></div>
            <div><dt>Lương cơ bản</dt><dd>${money(inputs.salary.baseSalary)}</dd></div>
            <div><dt>Lương tính OT</dt><dd>${money(inputs.salary.otSalary)}</dd></div>
            <div><dt>Xjob + MSC</dt><dd>${money(inputs.salary.xjobSalary + inputs.salary.mscSalary)}</dd></div>
            <div><dt>Phụ thuộc</dt><dd>${inputs.tax.dependents || 0}</dd></div>
            <div><dt>Dòng OT</dt><dd>${otLineCount || inputs.otRows.length}</dd></div>
          </dl>
        </article>
      `;
    })
    .join("");
};

const migrateLegacyHistoryIfNeeded = async (username) => {
  if (!supabaseClient || !session.userId || !username) return;
  const legacyItems = getLegacyLocalHistory(username);
  if (!legacyItems.length) return;

  const rowsToInsert = legacyItems.map((item) => ({
    user_id: session.userId,
    pre_tax_salary: Math.round(Number(item.preTaxSalary) || 0),
    ot_total: Math.round(Number(item.otTotal) || 0),
    taxable_income: Math.round(Number(item.taxableIncome) || 0),
    tax_due: Math.round(Number(item.taxDue) || 0),
    insurance: Math.round(Number(item.insurance) || 0),
    net_income: Math.round(Number(item.netIncome) || 0),
    inputs: getEntryInputs(item),
  }));

  const { error } = await supabaseClient.from("salary_histories").insert(rowsToInsert);
  if (!error) {
    clearLegacyLocalHistory(username);
  }
};

const fetchCloudHistory = async () => {
  if (!supabaseClient || !session.userId) {
    historyItems = [];
    renderHistory();
    return;
  }

  renderHistory("Đang tải lịch sử từ đám mây...");
  const { data, error } = await supabaseClient
    .from("salary_histories")
    .select("id, pre_tax_salary, ot_total, taxable_income, tax_due, insurance, net_income, inputs, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    elements.historyNotice.textContent = `Không thể tải lịch sử: ${error.message}`;
    return;
  }

  historyItems = (data || []).map(mapDbRowToHistoryItem);
  renderHistory();
};

const saveCurrentCalculation = async () => {
  if (!session.userId) {
    openLogin();
    elements.historyNotice.textContent = "Vui lòng đăng nhập trước khi lưu lịch sử.";
    return;
  }

  if (!supabaseClient || isSavingHistory) return;

  const data = renderCalculatedValues();
  isSavingHistory = true;
  elements.calculateBtn.disabled = true;
  elements.calculateBtn.textContent = "Đang lưu...";

  try {
    const payload = {
      user_id: session.userId,
      pre_tax_salary: Math.round(data.preTaxSalary),
      ot_total: Math.round(data.ot.total),
      taxable_income: Math.round(data.taxableIncome),
      tax_due: Math.round(data.taxDue),
      insurance: Math.round(data.insurance),
      net_income: Math.round(data.netIncome),
      inputs: collectInputs(data),
    };

    const { data: insertedRow, error } = await supabaseClient
      .from("salary_histories")
      .insert(payload)
      .select("id, pre_tax_salary, ot_total, taxable_income, tax_due, insurance, net_income, inputs, created_at")
      .single();

    if (error) throw error;

    historyItems.unshift(mapDbRowToHistoryItem(insertedRow));
    renderHistory();
  } catch (error) {
    elements.historyNotice.textContent = `Lỗi khi lưu lịch sử: ${error.message}`;
  } finally {
    isSavingHistory = false;
    elements.calculateBtn.disabled = false;
    elements.calculateBtn.textContent = "Tính / Lưu";
  }
};

const resetForm = () => {
  setMoneyInputValue(elements.baseSalary, 0);
  setMoneyInputValue(elements.otSalary, 0);
  setMoneyInputValue(elements.xjobSalary, 0);
  setMoneyInputValue(elements.mscSalary, 0);
  setMoneyInputValue(elements.allowance, 0);
  nextOtRowId = 1;
  otRows = [createOtRow()];
  nextOtRowId += 1;
  renderOtRows();
  setMoneyInputValue(elements.personalDeduction, PERSONAL_DEDUCTION_2026);
  elements.dependents.value = 0;
  setMoneyInputValue(elements.insurance, 0);
  setMoneyInputValue(elements.utopAdvance, 0);
  setMoneyInputValue(elements.unionFee, 0);
  setMoneyInputValue(elements.latePenalty, 0);
  renderCalculatedValues();
};

const openLogin = () => {
  setAuthMode("login");
  elements.loginEmail.value = session.user;
  elements.loginPassword.value = "";
  elements.registerDisplayName.value = "";
  elements.registerConfirmPassword.value = "";
  elements.authStatus.textContent = "Tài khoản và lịch sử được lưu trữ trên Supabase để xem trên mọi thiết bị.";
  elements.loginModal.classList.remove("hidden");
  elements.loginEmail.focus();
};

const closeLogin = () => {
  elements.loginModal.classList.add("hidden");
};

const setAuthMode = (mode) => {
  authMode = mode;
  const isRegister = mode === "register";
  elements.loginModeBtn.classList.toggle("active", !isRegister);
  elements.registerModeBtn.classList.toggle("active", isRegister);
  elements.displayNameField.classList.toggle("hidden", !isRegister);
  elements.displayNameField.hidden = !isRegister;
  elements.confirmPasswordField.classList.toggle("hidden", !isRegister);
  elements.confirmPasswordField.hidden = !isRegister;
  elements.loginSubmit.textContent = isRegister ? "Đăng ký" : "Đăng nhập";
  elements.loginPassword.autocomplete = isRegister ? "new-password" : "current-password";
  elements.authStatus.innerHTML = isRegister
    ? "Tạo tài khoản mới để đồng bộ lịch sử tính lương trên mọi thiết bị."
    : "Đăng nhập để xem và lưu lịch sử tính lương trên đám mây.";
};

const syncSessionFromAuthUser = async (authUser) => {
  if (!authUser) {
    session.userId = "";
    session.user = "";
    session.displayName = "";
    historyItems = [];
    renderAccount();
    renderHistory();
    return;
  }

  const fallbackUsername =
    authUser.user_metadata?.username ||
    (authUser.email ? authUser.email.replace(/@salarycalculator\.local$/i, "") : authUser.id);
  const fallbackDisplayName = authUser.user_metadata?.display_name || fallbackUsername;

  session.userId = authUser.id;
  session.user = fallbackUsername;
  session.displayName = fallbackDisplayName;

  if (supabaseClient) {
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("username, display_name")
      .eq("id", authUser.id)
      .maybeSingle();

    if (profile) {
      session.user = profile.username || session.user;
      session.displayName = profile.display_name || session.displayName;
    }
  }

  renderAccount();
  await migrateLegacyHistoryIfNeeded(session.user);
  await fetchCloudHistory();
};

const submitAuth = async () => {
  if (!supabaseClient) {
    elements.authStatus.textContent = "Không thể kết nối tới dịch vụ Supabase.";
    return;
  }

  const user = normalizeUsername(elements.loginEmail.value);
  const password = elements.loginPassword.value.trim();

  if (!user || !password) {
    alert("Vui lòng nhập tài khoản và mật khẩu.");
    return;
  }

  if (authMode === "register") {
    const confirmPassword = elements.registerConfirmPassword.value.trim();
    if (password.length < 4) {
      elements.authStatus.textContent = "Mật khẩu cần có ít nhất 4 ký tự.";
      return;
    }
    if (password !== confirmPassword) {
      elements.authStatus.textContent = "Mật khẩu nhập lại chưa khớp.";
      return;
    }
  }

  const email = toAuthEmail(user);
  const displayName = elements.registerDisplayName.value.trim() || user;

  elements.loginSubmit.disabled = true;
  elements.authStatus.textContent = authMode === "register" ? "Đang tạo tài khoản..." : "Đang đăng nhập...";

  try {
    if (authMode === "register") {
      if (session.userId) {
        await supabaseClient.auth.signOut();
      }
      const { error: registerError } = await supabaseClient.rpc("register_account", {
        p_identifier: user,
        p_password: password,
        p_display_name: displayName,
      });
      if (registerError) {
        throw new Error(registerError.message);
      }
    }

    const { data: signInData, error: signInError } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      throw new Error(
        signInError.message.includes("Invalid login credentials")
          ? "Tài khoản hoặc mật khẩu không đúng."
          : signInError.message
      );
    }

    closeLogin();
    await syncSessionFromAuthUser(signInData.user);
  } catch (error) {
    elements.authStatus.textContent = error.message || "Có lỗi xảy ra khi xác thực.";
  } finally {
    elements.loginSubmit.disabled = false;
  }
};

const signOutUser = async () => {
  if (!supabaseClient) return;
  await supabaseClient.auth.signOut();
  await syncSessionFromAuthUser(null);
};

const deleteHistoryItem = async (id, index) => {
  if (!supabaseClient || !session.userId) return;

  const { error } = await supabaseClient
    .from("salary_histories")
    .delete()
    .eq("id", id);

  if (error) {
    elements.historyNotice.textContent = `Không thể xóa bản ghi: ${error.message}`;
    return;
  }

  historyItems.splice(index, 1);
  renderHistory();
};

const addOtRow = () => {
  syncOtRowsFromDom();
  otRows.push(createOtRow());
  nextOtRowId += 1;
  renderOtRows();
  renderCalculatedValues();
};

const deleteOtRow = (rowId) => {
  syncOtRowsFromDom();
  otRows = otRows.filter((row) => row.id !== rowId);
  renderOtRows();
  renderCalculatedValues();
};

document.addEventListener("input", (event) => {
  const element = event.target;
  if (!(element instanceof HTMLInputElement)) return;
  if (element.closest(".modal")) return;
  if (element.classList.contains("money-input")) {
    normalizeMoneyInput(element);
  }
  renderCalculatedValues();
});

document.addEventListener("focusin", (event) => {
  clearDefaultZero(event.target);
});

document.addEventListener("focusout", (event) => {
  restoreEmptyNumber(event.target);
});

document.addEventListener("change", (event) => {
  const element = event.target;
  if (!(element instanceof HTMLInputElement) && !(element instanceof HTMLSelectElement)) return;
  if (element.closest(".modal")) return;
  renderCalculatedValues();
});

elements.calculateBtn.addEventListener("click", saveCurrentCalculation);
elements.resetBtn.addEventListener("click", resetForm);
elements.addOtRowBtn.addEventListener("click", addOtRow);
elements.btnLogin.addEventListener("click", openLogin);
elements.btnLogout?.addEventListener("click", signOutUser);
elements.loginCancel.addEventListener("click", closeLogin);
elements.loginModeBtn.addEventListener("click", () => setAuthMode("login"));
elements.registerModeBtn.addEventListener("click", () => setAuthMode("register"));
elements.loginSubmit.addEventListener("click", submitAuth);

elements.loginModal.addEventListener("click", (event) => {
  if (event.target === elements.loginModal) closeLogin();
});

elements.loginPassword.addEventListener("keydown", (event) => {
  if (event.key === "Enter") submitAuth();
});

elements.registerConfirmPassword.addEventListener("keydown", (event) => {
  if (event.key === "Enter") submitAuth();
});

elements.historyList.addEventListener("click", (event) => {
  const item = event.target.closest(".history-item");
  if (!item) return;

  const index = Number(item.dataset.index);
  const actionButton = event.target.closest("button");
  if (actionButton?.dataset.action === "delete") {
    deleteHistoryItem(Number(item.dataset.id), index);
    return;
  }

  if (historyItems[index]) {
    applyHistoryEntry(historyItems[index]);
  }
});

elements.otRowsContainer.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action='delete-ot-row']");
  if (!button) return;
  const row = button.closest(".ot-row");
  deleteOtRow(Number(row.dataset.otRow));
});

const initAuthSession = async () => {
  if (!supabaseClient) return;
  const { data } = await supabaseClient.auth.getSession();
  await syncSessionFromAuthUser(data?.session?.user || null);
};

renderAccount();
otRows = [createOtRow()];
nextOtRowId += 1;
renderOtRows();
renderCalculatedValues();
renderHistory();
initAuthSession();
