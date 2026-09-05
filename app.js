const PACKAGES = [
  { coins: 250, price: 3.03 },
  { coins: 500, price: 6.07 },
  { coins: 15000, price: 181.8 },
];

// Rate per Coin: dipakai untuk Tiktok Coins Balance DAN untuk modal jumlah khusus (keypad)
const BALANCE_COIN_UNIT_PRICE = 0.013; // $ per coin

const state = {
  coinBalance: 100.1,
  coinEquivalent: Math.round(100.1 / BALANCE_COIN_UNIT_PRICE),
  selectedPackage: null,
  customAmount: null,
  customCoins: null,
  activeUsername: null,
  transactions: [],
};

// Digit yang sedang diketik di keypad modal jumlah khusus
let modalDigits = "";

// ---- Helpers ----
const $ = (id) => document.getElementById(id);

function formatUSD(value) {
  return "$" + value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function coinIconSVG(size = 13) {
  return `<img class="coin-mark" src="icons/coin-64.png" alt="" width="${size}" height="${size}" />`;
}

// ---- Render ----
function renderBalanceCompare() {
  $("balanceCompare").innerHTML = `= ${formatUSD(state.coinBalance)} (${coinIconSVG(12)}${state.coinEquivalent.toLocaleString("en-US")})`;
}

function renderBalance() {
  $("coinBalanceInput").value = formatUSD(state.coinBalance);
  renderBalanceCompare();
}

function renderPackages() {
  const wrap = $("packages");
  wrap.innerHTML = "";
  PACKAGES.forEach((pkg, i) => {
    const affordable = state.coinBalance >= pkg.price;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "package" + (state.selectedPackage === i ? " selected" : "") + (!affordable ? " disabled" : "");
    btn.setAttribute("role", "option");
    btn.setAttribute("aria-selected", state.selectedPackage === i ? "true" : "false");
    btn.disabled = !affordable;
    btn.innerHTML = `
      <span class="coin-amt">${coinIconSVG()}${pkg.coins.toLocaleString("en-US")}</span>
      <span class="price">${formatUSD(pkg.price)}</span>
    `;
    btn.addEventListener("click", () => selectPackage(i));
    wrap.appendChild(btn);
  });
}

function renderExchangeButton() {
  const btn = $("exchangeBtn");
  const hasSelection = state.selectedPackage !== null || (state.customCoins && state.customCoins > 0);
  btn.disabled = !(state.activeUsername && hasSelection);
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), 2200);
}

// ---- Actions ----
function selectPackage(index) {
  state.selectedPackage = state.selectedPackage === index ? null : index;
  if (state.selectedPackage !== null) {
    state.customAmount = null;
    state.customCoins = null;
    $("customAmountInput").value = "";
  }
  renderPackages();
  renderExchangeButton();
}

function handleUsernameInput(raw) {
  const clean = raw.trim().replace(/^@/, "");
  $("clearBtn").hidden = clean.length === 0;
  state.activeUsername = clean.length > 0 ? clean : null;
  renderExchangeButton();
}

function handleBalanceInput(raw) {
  const numeric = raw.replace(/[^0-9.]/g, "");
  const value = parseFloat(numeric);
  if (Number.isFinite(value)) {
    state.coinBalance = value;
    state.coinEquivalent = Math.round(value / BALANCE_COIN_UNIT_PRICE);
    renderBalanceCompare();
  }
}

function handleBalanceBlur() {
  if (!Number.isFinite(state.coinBalance)) state.coinBalance = 0;
  $("coinBalanceInput").value = formatUSD(state.coinBalance);
}

// ---- Modal jumlah khusus (keypad) ----
const MODAL_MAX_DIGITS = 9;

function currentModalCoins() {
  return modalDigits === "" ? 0 : parseInt(modalDigits, 10);
}

function renderModal() {
  const coins = currentModalCoins();
  const cost = coins * BALANCE_COIN_UNIT_PRICE;
  $("modalCoinAmount").textContent = coins.toLocaleString("en-US");
  $("modalApprox").textContent = "≈ " + formatUSD(cost);
  $("modalTotalValue").textContent = formatUSD(cost);
  $("modalExchangeBtn").disabled = coins <= 0 || cost > state.coinBalance;
}

function openCustomModal() {
  modalDigits = state.customCoins ? String(state.customCoins) : "";
  renderModal();
  $("customModalOverlay").classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeCustomModal() {
  $("customModalOverlay").classList.remove("open");
  document.body.style.overflow = "";
}

function handleKeypadPress(key) {
  if (key === "back") {
    modalDigits = modalDigits.slice(0, -1);
  } else if (key === "000") {
    if (modalDigits === "" || modalDigits === "0") return;
    if (modalDigits.length + 3 <= MODAL_MAX_DIGITS) modalDigits += "000";
  } else {
    if (modalDigits === "0") modalDigits = key;
    else if (modalDigits.length < MODAL_MAX_DIGITS) modalDigits += key;
  }
  renderModal();
}

function handleModalAll() {
  // Ambil datanya dari Tiktok Coins Balance (Number of Coins yang dimiliki)
  const maxCoins = Math.max(0, state.coinEquivalent);
  modalDigits = String(maxCoins);
  renderModal();
}

function confirmModal() {
  const coins = currentModalCoins();
  const cost = coins * BALANCE_COIN_UNIT_PRICE;
  if (coins <= 0) return;
  if (cost > state.coinBalance) {
    showToast("Tiktok Coins Balance tidak cukup untuk jumlah ini");
    return;
  }
  if (!state.activeUsername) {
    showToast("Isi TikTok username terlebih dahulu");
    return;
  }
  state.customCoins = coins;
  state.customAmount = cost;
  state.selectedPackage = null;
  $("customAmountInput").value = `${coins.toLocaleString("en-US")} Coin (${formatUSD(cost)})`;
  renderPackages();
  renderExchangeButton();
  closeCustomModal();
  openConfirmModal();
}

// ---- Popup konfirmasi "Complete exchange?" ----
function getPendingExchange() {
  const hasPackage = state.selectedPackage !== null;
  const hasCustom = state.customCoins && state.customCoins > 0;
  if (!hasPackage && !hasCustom) return null;
  const price = hasPackage ? PACKAGES[state.selectedPackage].price : state.customAmount;
  const coins = hasPackage ? PACKAGES[state.selectedPackage].coins : state.customCoins;
  return { price, coins };
}

function openConfirmModal() {
  if (!state.activeUsername) return;
  const pending = getPendingExchange();
  if (!pending) return;

  $("confirmText").innerHTML =
    `${formatUSD(pending.price)} will be deducted from LIVE rewards balance and sent to <strong>@${state.activeUsername}</strong>`;
  $("confirmModalOverlay").classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeConfirmModal() {
  $("confirmModalOverlay").classList.remove("open");
  document.body.style.overflow = "";
}

function setConfirmLoading(loading) {
  const okBtn = $("confirmOkBtn");
  const cancelBtn = $("confirmCancelBtn");
  if (loading) {
    okBtn.dataset.label = okBtn.textContent;
    okBtn.innerHTML = '<span class="btn-spinner" aria-label="Memuat"></span>';
    okBtn.disabled = true;
    cancelBtn.disabled = true;
  } else {
    okBtn.textContent = okBtn.dataset.label || "Exchange";
    okBtn.disabled = false;
    cancelBtn.disabled = false;
  }
}

function performExchange() {
  const pending = getPendingExchange();
  if (!state.activeUsername || !pending) return null;
  const { price, coins } = pending;

  if (state.coinBalance < price) {
    showToast("Tiktok Coins Balance tidak cukup untuk jumlah ini");
    return null;
  }

  const username = state.activeUsername;

  state.coinBalance -= price;
  state.coinEquivalent -= coins;
  state.selectedPackage = null;
  state.customAmount = null;
  state.customCoins = null;
  $("customAmountInput").value = "";

  renderBalance();
  renderPackages();
  renderExchangeButton();

  const time = new Date();
  state.transactions.unshift({ price, coins, username, time });

  return { price, coins, username, time };
}

// ---- Halaman "Exchange Completed!" ----
function formatExchangeTime(date) {
  const datePart = date.toLocaleDateString("en-US");
  const timePart = date.toLocaleTimeString("en-GB", { hour12: false });
  return `${datePart}, ${timePart}`;
}

function showSuccessScreen(result) {
  $("successCoinsHeadline").textContent = result.coins.toLocaleString("en-US");
  $("successRecipient").textContent = `@${result.username}`;
  $("successCoinsExchanged").textContent = `${result.coins.toLocaleString("en-US")} Coins`;
  $("successDeducted").textContent = formatUSD(result.price);
  $("successTime").textContent = formatExchangeTime(result.time);

  $("mainScreen").hidden = true;
  $("successScreen").hidden = false;
  window.scrollTo(0, 0);

  setTimeout(showPushNotification, 700);
}

// ---- Notifikasi push ala iOS ----
let pushToastTimer = null;

function showPushNotification() {
  const el = $("pushToast");
  clearTimeout(pushToastTimer);
  $("pushToastTime").textContent = "now";
  el.classList.add("show");
  pushToastTimer = setTimeout(() => {
    el.classList.remove("show");
  }, 4000);
}

// ---- Halaman ke-3: Rewards dashboard ----
function animateNumberDecrease(el, target, { decimals = 2, prefix = "$", duration = 1400 } = {}) {
  const safeTarget = Number.isFinite(target) ? target : 0;
  const boost = Math.max(safeTarget * 0.35, 80);
  const start = safeTarget + boost;
  const startTime = performance.now();

  function tick(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = start - (start - safeTarget) * eased;
    el.textContent = prefix + current.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      el.textContent = prefix + safeTarget.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    }
  }
  requestAnimationFrame(tick);
}

function renderRewardsHistory() {
  const container = $("rewardsHistory");
  const list = state.transactions;

  if (list.length === 0) {
    container.innerHTML = '<p class="rewards-history-empty">Belum ada riwayat transaksi.</p>';
    return;
  }

  // Kelompokkan transaksi berdasarkan bulan & tahun asli waktu transaksi
  const groups = [];
  let currentKey = null;
  let currentGroup = null;

  list.forEach((tx) => {
    const key = `${tx.time.getFullYear()}-${tx.time.getMonth()}`;
    if (key !== currentKey) {
      currentKey = key;
      currentGroup = {
        label: tx.time.toLocaleString("en-US", { month: "short", year: "numeric" }),
        items: [],
      };
      groups.push(currentGroup);
    }
    currentGroup.items.push(tx);
  });

  const html = groups
    .map((group) => {
      const rows = group.items
        .map((tx) => {
          const title = `Sent ${tx.coins.toLocaleString("en-US")} Coins to @${tx.username}`;
          const time = tx.time.toLocaleString("en-US");
          return `
            <div class="rewards-history-item">
              <div class="rewards-history-main">
                <span class="rewards-history-title">${title}</span>
                <span class="rewards-history-time">${time}</span>
              </div>
              <span class="rewards-history-amount">-${formatUSD(tx.price)}</span>
            </div>`;
        })
        .join("");

      return `
        <div class="rewards-history-month-row">
          <span class="rewards-history-heading">Transactions</span>
          <span class="rewards-history-heading">${group.label}</span>
        </div>
        ${rows}`;
    })
    .join("");

  container.innerHTML = html;
}

function goToRewardsScreen() {
  $("successScreen").hidden = true;
  $("rewardsScreen").hidden = false;
  window.scrollTo(0, 0);

  const balance = state.coinBalance;
  animateNumberDecrease($("rewardsAvailableSmall"), balance, { decimals: 2 });
  animateNumberDecrease($("rewardsAvailableBig"), balance, { decimals: 2 });

  $("rewardsAvailableSubUsd").textContent = formatUSD(balance);
  $("rewardsAvailableSubCoins").textContent = Math.max(0, Math.round(state.coinEquivalent)).toLocaleString("en-US");

  renderRewardsHistory();
}

function goFromRewardsToExchange() {
  $("rewardsScreen").hidden = true;
  $("mainScreen").hidden = false;
  window.scrollTo(0, 0);
}


// ---- TikTok username autocomplete (self-hosted TikTok-Api backend) ----
let usernameSearchTimer = null;
let usernameSearchAbort = null;
let usernameSuggestions = [];

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function compactNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

function avatarFallback(name) {
  const letter = (String(name || "?").trim()[0] || "?").toUpperCase();
  return `<span class="suggestion-avatar-fallback">${escapeHtml(letter)}</span>`;
}

function renderUsernameSuggestions(items) {
  const box = $("usernameSuggestions");
  usernameSuggestions = Array.isArray(items) ? items : [];
  if (!usernameSuggestions.length) {
    box.hidden = true;
    box.innerHTML = "";
    $("usernameInput").setAttribute("aria-expanded", "false");
    return;
  }

  box.innerHTML = usernameSuggestions.map((user, index) => {
    const avatar = user.avatar_url
      ? `<img src="${escapeHtml(user.avatar_url)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'), {className:'suggestion-avatar-fallback', textContent:'${escapeHtml((user.display_name || user.username || '?')[0] || '?')}'}))">`
      : avatarFallback(user.display_name || user.username);
    return `<button type="button" class="username-suggestion" data-index="${index}" role="option">
      <span class="suggestion-avatar">${avatar}</span>
      <span class="suggestion-main">
        <span class="suggestion-name">${escapeHtml(user.display_name || user.username)}</span>
        <span class="suggestion-handle">@${escapeHtml(user.username)}</span>
        <span class="suggestion-stats">${compactNumber(user.follower_count)} followers · ${compactNumber(user.following_count)} following</span>
      </span>
      ${user.verified ? '<span class="suggestion-verified" aria-label="Verified">✓</span>' : ''}
    </button>`;
  }).join("");
  box.hidden = false;
  $("usernameInput").setAttribute("aria-expanded", "true");
}

function hideUsernameSuggestions() {
  const box = $("usernameSuggestions");
  box.hidden = true;
  box.innerHTML = "";
  $("usernameInput").setAttribute("aria-expanded", "false");
  $("usernameSearchStatus").textContent = "";
  usernameSuggestions = [];
}

async function searchTikTokUsers(query) {
  const q = query.trim().replace(/^@+/, "");
  if (q.length < 2) {
    hideUsernameSuggestions();
    return;
  }

  if (usernameSearchAbort) usernameSearchAbort.abort();
  usernameSearchAbort = new AbortController();
  $("usernameSearchStatus").textContent = "Searching…";

  try {
    const response = await fetch(`${window.MUSTIKA_API_BASE || ''}/api/tiktok/search?q=${encodeURIComponent(q)}`, {
      signal: usernameSearchAbort.signal,
      headers: { Accept: "application/json" },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Search failed");
    if ($("usernameInput").value.trim().replace(/^@+/, "") !== q) return;
    renderUsernameSuggestions(payload.users || []);
    $("usernameSearchStatus").textContent = payload.users?.length ? "" : "No users found";
  } catch (error) {
    if (error.name === "AbortError") return;
    console.warn("TikTok autocomplete:", error);
    hideUsernameSuggestions();
    $("usernameSearchStatus").textContent = "TikTok search unavailable";
  }
}

function scheduleTikTokSearch(raw) {
  clearTimeout(usernameSearchTimer);
  const q = raw.trim().replace(/^@+/, "");
  if (q.length < 2) {
    hideUsernameSuggestions();
    return;
  }
  usernameSearchTimer = setTimeout(() => searchTikTokUsers(q), 450);
}

function selectUsernameSuggestion(user) {
  const username = String(user?.username || "").replace(/^@+/, "");
  if (!username) return;
  $("usernameInput").value = username;
  handleUsernameInput(username);
  hideUsernameSuggestions();
}

// ---- Wire up ----
window.addEventListener("DOMContentLoaded", () => {
  renderBalance();
  renderPackages();
  renderExchangeButton();

  $("usernameInput").addEventListener("input", (e) => {
    handleUsernameInput(e.target.value);
    scheduleTikTokSearch(e.target.value);
  });
  $("usernameSuggestions").addEventListener("click", (e) => {
    const button = e.target.closest(".username-suggestion");
    if (!button) return;
    const user = usernameSuggestions[Number(button.dataset.index)];
    selectUsernameSuggestion(user);
  });
  $("usernameInput").addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideUsernameSuggestions();
    if (e.key === "Enter" && usernameSuggestions[0]) {
      e.preventDefault();
      selectUsernameSuggestion(usernameSuggestions[0]);
    }
  });
  document.addEventListener("click", (e) => {
    const wrap = e.target.closest(".username-autocomplete");
    if (!wrap) hideUsernameSuggestions();
  });
  $("clearBtn").addEventListener("click", () => {
    $("usernameInput").value = "";
    handleUsernameInput("");
    $("usernameInput").focus();
  });
  $("coinBalanceInput").addEventListener("input", (e) => handleBalanceInput(e.target.value));
  $("coinBalanceInput").addEventListener("blur", handleBalanceBlur);
  $("exchangeBtn").addEventListener("click", openConfirmModal);
  $("backBtn").addEventListener("click", () => {
    if (window.history.length > 1) window.history.back();
  });
  $("successBackBtn").addEventListener("click", goToRewardsScreen);
  $("pushToast").addEventListener("click", () => {
    clearTimeout(pushToastTimer);
    $("pushToast").classList.remove("show");
  });

  // Halaman Rewards (halaman ke-3)
  $("rewardsExchangeBtn").addEventListener("click", goFromRewardsToExchange);
  $("rewardsWithdrawBtn").addEventListener("click", () => {
    showToast("Fitur Withdraw belum tersedia");
  });
  $("rewardsPromoClose").addEventListener("click", () => {
    $("rewardsPromoWrap").style.display = "none";
  });
  $("rewardsLearnMore").addEventListener("click", (e) => {
    e.preventDefault();
  });

  // Popup konfirmasi "Complete exchange?"
  $("confirmModalClose").addEventListener("click", () => {
    if ($("confirmOkBtn").disabled) return;
    closeConfirmModal();
  });
  $("confirmCancelBtn").addEventListener("click", closeConfirmModal);
  $("confirmOkBtn").addEventListener("click", () => {
    setConfirmLoading(true);
    setTimeout(() => {
      const result = performExchange();
      setConfirmLoading(false);
      closeConfirmModal();
      if (result) showSuccessScreen(result);
    }, 2000);
  });
  $("confirmModalOverlay").addEventListener("click", (e) => {
    if (e.target === $("confirmModalOverlay") && !$("confirmOkBtn").disabled) closeConfirmModal();
  });

  // Modal jumlah khusus (keypad angka)
  $("customAmountInput").addEventListener("click", openCustomModal);
  $("customModalClose").addEventListener("click", closeCustomModal);
  $("customModalOverlay").addEventListener("click", (e) => {
    if (e.target === $("customModalOverlay")) closeCustomModal();
  });
  $("modalAllBtn").addEventListener("click", handleModalAll);
  $("modalExchangeBtn").addEventListener("click", confirmModal);
  $("modalKeypad").addEventListener("click", (e) => {
    const btn = e.target.closest(".keypad-btn");
    if (!btn) return;
    handleKeypadPress(btn.dataset.key);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if ($("confirmModalOverlay").classList.contains("open")) {
      if (!$("confirmOkBtn").disabled) closeConfirmModal();
    } else if ($("customModalOverlay").classList.contains("open")) {
      closeCustomModal();
    }
  });
});

// ---- Service worker registration ----
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}
