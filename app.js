const MONEY_FORMATTER = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 0,
});

const DEPENDENT_DEDUCTION = 6200000;
const PERSONAL_DEDUCTION_2026 = 15500000;

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

  baseSalary: document.getElementById("baseSalary"),
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

const session = {
  user: localStorage.getItem("salaryCalculator.currentUser") || "",
};

let authMode = "login";
let nextOtRowId = 1;
let otRows = [];

const historyKey = () => `salaryCalculator.history.${session.user}`;

const getHistory = () => {
  if (!session.user) return [];
  try {
    return JSON.parse(localStorage.getItem(historyKey()) || "[]");
  } catch {
    return [];
  }
};

const saveHistory = (history) => {
  if (!session.user) return;
  localStorage.setItem(historyKey(), JSON.stringify(history));
};

const getStoredUsers = () => {
  try {
    return JSON.parse(localStorage.getItem("salaryCalculator.users") || "[]");
  } catch {
    return [];
  }
};

const saveStoredUsers = (users) => {
  localStorage.setItem("salaryCalculator.users", JSON.stringify(users));
};

const normalizeUsername = (username) => username.trim().toLowerCase();

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
  const baseSalary = num(elements.baseSalary);
  const hourlyBase = baseSalary / 22 / 8;
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
  if (entry.inputs?.salary) return entry.inputs;

  return {
    salary: {
      baseSalary: entry.inputs?.baseSalary || 0,
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
  if (session.user) {
    elements.accountBadge.textContent = session.user;
    elements.btnLogin.textContent = "Đổi tài khoản";
  } else {
    elements.accountBadge.textContent = "Chưa đăng nhập";
    elements.btnLogin.textContent = "Đăng nhập";
  }
};

const renderHistory = () => {
  if (!session.user) {
    elements.historyNotice.textContent = "Đăng nhập để lưu và xem lịch sử từng lần tính.";
    elements.historyList.innerHTML = "";
    return;
  }

  const history = getHistory();
  elements.historyNotice.textContent = history.length
    ? `Đang hiển thị ${history.length} bản ghi của ${session.user}.`
    : "Chưa có lịch sử. Bấm Tính / Lưu để tạo bản ghi đầu tiên.";

  elements.historyList.innerHTML = history
    .slice()
    .reverse()
    .map((item, reversedIndex) => {
      const index = history.length - 1 - reversedIndex;
      const inputs = getEntryInputs(item);
      const otLineCount = inputs.otRows?.filter((row) => Number(row.hours) > 0).length || 0;
      return `
        <article class="history-item" data-index="${index}" data-action="reuse">
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
            <div><dt>Xjob + MSC</dt><dd>${money(inputs.salary.xjobSalary + inputs.salary.mscSalary)}</dd></div>
            <div><dt>Phụ thuộc</dt><dd>${inputs.tax.dependents || 0}</dd></div>
            <div><dt>Dòng OT</dt><dd>${otLineCount || inputs.otRows.length}</dd></div>
          </dl>
        </article>
      `;
    })
    .join("");
};

const saveCurrentCalculation = () => {
  if (!session.user) {
    openLogin();
    elements.historyNotice.textContent = "Vui lòng đăng nhập trước khi lưu lịch sử.";
    return;
  }

  const data = renderCalculatedValues();
  const history = getHistory();
  history.push({
    createdAt: new Date().toLocaleString("vi-VN"),
    preTaxSalary: Math.round(data.preTaxSalary),
    otTotal: Math.round(data.ot.total),
    taxableIncome: Math.round(data.taxableIncome),
    taxDue: Math.round(data.taxDue),
    insurance: Math.round(data.insurance),
    netIncome: Math.round(data.netIncome),
    inputs: collectInputs(data),
  });
  saveHistory(history);
  renderHistory();
};

const resetForm = () => {
  setMoneyInputValue(elements.baseSalary, 0);
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
  elements.authStatus.textContent = "Tài khoản được lưu trong trình duyệt bằng localStorage.";
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
  elements.confirmPasswordField.classList.toggle("hidden", !isRegister);
  elements.loginSubmit.textContent = isRegister ? "Đăng ký" : "Đăng nhập";
  elements.loginPassword.autocomplete = isRegister ? "new-password" : "current-password";
  elements.authStatus.innerHTML = isRegister
    ? "Tài khoản mới sẽ được lưu trong localStorage của trình duyệt này."
    : "Đăng nhập bằng tài khoản đã đăng ký trên trình duyệt này.";
};

const registerLocalUser = (username, password, displayName) => {
  const users = getStoredUsers();
  const normalizedUsername = normalizeUsername(username);
  if (users.some((item) => item.username === normalizedUsername)) {
    throw new Error("Tài khoản này đã tồn tại trên trình duyệt này.");
  }

  const user = {
    username: normalizedUsername,
    displayName: displayName || normalizedUsername,
    password,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  saveStoredUsers(users);
  return user;
};

const loginLocalUser = (username, password) => {
  const normalizedUsername = normalizeUsername(username);
  const user = getStoredUsers().find((item) => item.username === normalizedUsername);
  if (!user || user.password !== password) {
    throw new Error("Tài khoản hoặc mật khẩu không đúng.");
  }
  return user;
};

const submitAuth = () => {
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

  try {
    const authUser = authMode === "register"
      ? registerLocalUser(user, password, elements.registerDisplayName.value.trim())
      : loginLocalUser(user, password);

    session.user = authUser.username;
    localStorage.setItem("salaryCalculator.currentUser", authUser.username);
    closeLogin();
    renderAccount();
    renderHistory();
  } catch (error) {
    elements.authStatus.textContent = error.message;
  }
};

const deleteHistoryItem = (index) => {
  const history = getHistory();
  history.splice(index, 1);
  saveHistory(history);
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

  const actionButton = event.target.closest("button");
  if (actionButton?.dataset.action === "delete") {
    deleteHistoryItem(Number(item.dataset.index));
    return;
  }

  const history = getHistory();
  applyHistoryEntry(history[Number(item.dataset.index)]);
});

elements.otRowsContainer.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action='delete-ot-row']");
  if (!button) return;
  const row = button.closest(".ot-row");
  deleteOtRow(Number(row.dataset.otRow));
});

renderAccount();
otRows = [createOtRow()];
nextOtRowId += 1;
renderOtRows();
renderCalculatedValues();
renderHistory();
