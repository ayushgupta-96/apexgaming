// Admin Console JavaScript Controller
let adminToken = localStorage.getItem("rmg_admin_token");
let activeTicketId = null;

function isValidAccessToken(value) {
  // This application uses signed JWT access tokens (three dot-separated segments).
  return typeof value === "string" && value.trim().split(".").length === 3;
}

function ensureAdminSession() {
  if (isValidAccessToken(adminToken)) return true;

  // Never send "Bearer null", "Bearer undefined", or an empty bearer token.
  localStorage.removeItem("rmg_admin_token");
  adminToken = null;

  // Route unauthenticated admins through the normal login flow and return here.
  window.location.href = "/?login=1&return=/admin.html&admin=1";
  return false;
}

document.addEventListener("DOMContentLoaded", () => {
  if (!ensureAdminSession()) return;
  loadDashboard();
  loadDeposits();
  loadWithdrawals();
  loadTickets();
  loadAml();
  loadAuditLogs();
});

const ADMIN_TABS = {
  dashboard: ["Operations Overview", "Monitor the platform, money movement and support queues."],
  deposits: ["Deposit Verification", "Review manual UPI deposits before wallet credit."],
  withdrawals: ["Withdrawal Queue", "Settle verified payouts and record payout UTRs."],
  whatsapp: ["Support Inbox", "Review and respond to player conversations."],
  aml: ["Risk & AML", "Review velocity alerts and fraud signals."],
  audit: ["Audit Trail", "Inspect administrative actions and reasons."]
};

function switchAdminTab(tabId) {
  document.querySelectorAll(".admin-section").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".admin-tab-btn").forEach(el => el.classList.remove("active"));

  const target = document.getElementById("adm-tab-" + tabId);
  if (target) target.classList.add("active");

  const btn = document.querySelector('.admin-tab-btn[data-tab="' + tabId + '"]');
  if (btn) {
    btn.classList.add("active");
    btn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }

  const meta = ADMIN_TABS[tabId] || ADMIN_TABS.dashboard;
  const title = document.getElementById("adminSectionTitle");
  const subtitle = document.getElementById("adminSectionSubtitle");
  if (title) title.textContent = meta[0];
  if (subtitle) subtitle.textContent = meta[1];

  if (tabId === "deposits") loadDeposits();
  if (tabId === "withdrawals") loadWithdrawals();
  if (tabId === "whatsapp") loadTickets();
  if (tabId === "aml") loadAml();
  if (tabId === "audit") loadAuditLogs();
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.hidden = false;
  modal.classList.add("active");
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove("active");
  modal.hidden = true;
}

function safeExternalUrl(value) {
  try {
    const url = new URL(String(value), window.location.origin);
    return url.protocol === "https:" || url.origin === window.location.origin ? url.href : "#";
  } catch (_) { return "#"; }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"
  }[ch]));
}

function getAuthHeaders() {
  if (!ensureAdminSession()) {
    throw new Error("Admin session missing or invalid. Please log in again.");
  }
  return {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + adminToken
  };
}

// ----------------------------------------------------
// Dashboard KPIs
// ----------------------------------------------------
async function loadDashboard() {
  try {
    const res = await fetch("/api/admin/dashboard", { headers: getAuthHeaders() });
    const data = await res.json();
    if (data.success) {
      const s = data.data;
      document.getElementById("kpiUsers").textContent = s.totalUsers;
      document.getElementById("kpiGgr").textContent = "₹" + Number(s.grossGamingRevenue).toFixed(2);
      document.getElementById("kpiDeposits").textContent = "₹" + Number(s.totalDepositedVolume).toFixed(2);
      document.getElementById("kpiEscrow").textContent = "₹" + Number(s.activeEscrowLiability).toFixed(2);

      document.getElementById("badgePendingDep").textContent = s.pendingDepositsCount;
      document.getElementById("badgePendingWdr").textContent = s.pendingWithdrawalsCount;
      document.getElementById("badgeOpenTickets").textContent = s.openWhatsAppTicketsCount;
    }
  } catch (e) {
    console.error("Dashboard error", e);
  }
}

// ----------------------------------------------------
// Deposit Approvals Queue
// ----------------------------------------------------
async function loadDeposits() {
  const tbody = document.getElementById("depositsTableBody");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="7" class="admin-empty">Loading deposit requests…</td></tr>`;

  try {
    const res = await fetch("/api/admin/deposits?page=0&size=50", {
      headers: getAuthHeaders(),
      cache: "no-store"
    });

    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      data = null;
    }

    if (!res.ok) {
      const message = data?.message || `HTTP ${res.status}`;
      throw new Error(message);
    }

    if (!data?.success) {
      throw new Error(data?.message || "Deposit queue request failed");
    }

    const page = data.data;
    const deposits = Array.isArray(page?.content) ? page.content : [];

    tbody.innerHTML = "";

    if (!deposits.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="admin-empty">No pending or under-review deposit requests.</td></tr>`;
      return;
    }

    deposits.forEach(dep => {
      const tr = document.createElement("tr");
      const statusBadge = dep.status === "UNDER_REVIEW" ? "badge-verified" : "badge-pending";

      tr.innerHTML = `
        <td><b style="color: var(--accent-gold);">${escapeHtml(dep.referenceCode)}</b></td>
        <td>${escapeHtml(dep.phoneNumber || dep.user?.phoneNumber || "-")}</td>
        <td><b>₹${Number(dep.amount || 0).toFixed(2)}</b></td>
        <td><span class="admin-badge ${statusBadge}">${escapeHtml(dep.status)}</span></td>
        <td>
          ${dep.utrNumber ? `<div style="font-size: 0.8rem;">UTR: <b>${escapeHtml(dep.utrNumber)}</b></div>` : '<span style="color:#81978e">UTR not submitted</span>'}
          ${dep.proofImageUrl ? `<a href="${safeExternalUrl(dep.proofImageUrl)}" target="_blank" rel="noopener noreferrer" style="color: #60a5fa; font-size: 0.8rem;">View Screenshot</a>` : ''}
        </td>
        <td>${dep.createdAt ? new Date(dep.createdAt).toLocaleString() : "-"}</td>
        <td>
          <button class="btn btn-success" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;" onclick="approveDeposit(${Number(dep.id)})">Approve</button>
          <button class="btn btn-danger" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;" onclick="rejectDeposit(${Number(dep.id)})">Reject</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (e) {
    console.error("Deposits load error", e);
    tbody.innerHTML = `<tr><td colspan="7" class="admin-empty" style="color:#ff8b9a">Could not load deposit requests: ${escapeHtml(e.message || "Unknown error")}</td></tr>`;
  }
}

async function approveDeposit(depositId) {
  const notes = prompt("Enter verification notes (optional):", "Verified in bank statement");
  if (notes === null) return;

  try {
    const res = await fetch("/api/admin/deposits/approve", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ depositId, adminNotes: notes })
    });
    const data = await res.json();
    if (data.success) {
      alert("Deposit approved! The payment was manually verified and the user wallet has been credited.");
      loadDeposits();
      loadDashboard();
    } else {
      alert("Approval error: " + data.message);
    }
  } catch (e) {
    alert("Error approving deposit");
  }
}

async function rejectDeposit(depositId) {
  const reason = prompt("Enter rejection reason for user:", "UTR not found in bank statement");
  if (!reason) return;

  try {
    const res = await fetch("/api/admin/deposits/reject", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ depositId, rejectionReason: reason })
    });
    const data = await res.json();
    if (data.success) {
      alert("Deposit rejected and user notified.");
      loadDeposits();
      loadDashboard();
    } else {
      alert("Rejection error: " + data.message);
    }
  } catch (e) {
    alert("Error rejecting deposit");
  }
}

// ----------------------------------------------------
// Withdrawal Approvals Queue
// ----------------------------------------------------
async function loadWithdrawals() {
  try {
    const res = await fetch("/api/admin/withdrawals?page=0&size=50", { headers: getAuthHeaders() });
    const data = await res.json();
    if (data.success) {
      const tbody = document.getElementById("withdrawalsTableBody");
      tbody.innerHTML = "";

      data.data.content.forEach(wdr => {
        const tr = document.createElement("tr");
        const statusBadge = wdr.status === "PAID" ? "badge-approved" : (wdr.status === "REJECTED" ? "badge-rejected" : "badge-pending");

        tr.innerHTML = `
          <td><b style="color: var(--accent-gold);">${escapeHtml(wdr.referenceCode)}</b></td>
          <td>${wdr.user.phoneNumber} (${wdr.accountHolderName})</td>
          <td><b>₹${Number(wdr.amount).toFixed(2)}</b></td>
          <td>${escapeHtml(wdr.destinationType)}</td>
          <td><code>${escapeHtml(wdr.accountNumberOrVpa)}</code></td>
          <td><span class="badge ${statusBadge}">${escapeHtml(wdr.status)}</span></td>
          <td>
            ${wdr.status !== 'PAID' && wdr.status !== 'REJECTED' ? `
              <button class="btn btn-success" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;" onclick="openPayoutModal(${wdr.id})">Mark Paid</button>
              <button class="btn btn-danger" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;" onclick="rejectWithdrawal(${wdr.id})">Reject</button>
            ` : (wdr.status === 'PAID' ? `<span style="color: var(--accent-emerald);">UTR: ${escapeHtml(wdr.payoutUtr)}</span>` : 'Refunded')}
          </td>
        `;
        tbody.appendChild(tr);
      });
    }
  } catch (e) {
    console.error("Withdrawals load error", e);
  }
}

function openPayoutModal(id) {
  document.getElementById("payoutWithdrawalId").value = id;
  document.getElementById("payoutUtrInput").value = "";
  openModal("payoutModal");
}

async function confirmApproveWithdrawal() {
  const wdrId = document.getElementById("payoutWithdrawalId").value;
  const utr = document.getElementById("payoutUtrInput").value;
  const totp = document.getElementById("payoutTotpInput").value || null;

  if (!utr) {
    alert("Bank UTR number is required for proof of payout");
    return;
  }

  try {
    const res = await fetch("/api/admin/withdrawals/approve", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ withdrawalId: wdrId, payoutUtr: utr, totpCode: totp })
    });
    const data = await res.json();
    if (data.success) {
      alert("Withdrawal marked as PAID! Locked funds debited via ledger and user notified.");
      closeModal("payoutModal");
      loadWithdrawals();
      loadDashboard();
    } else {
      alert("Payout error: " + data.message);
    }
  } catch (e) {
    alert("Error settling withdrawal");
  }
}

async function rejectWithdrawal(withdrawalId) {
  const reason = prompt("Enter withdrawal rejection reason:", "Bank account details mismatch");
  if (!reason) return;

  try {
    const res = await fetch("/api/admin/withdrawals/reject", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ withdrawalId, rejectionReason: reason })
    });
    const data = await res.json();
    if (data.success) {
      alert("Withdrawal rejected and funds refunded to user winnings balance.");
      loadWithdrawals();
      loadDashboard();
    } else {
      alert("Rejection error: " + data.message);
    }
  } catch (e) {
    alert("Error rejecting withdrawal");
  }
}

// ----------------------------------------------------
// WhatsApp Inbox
// ----------------------------------------------------
async function loadTickets() {
  try {
    const res = await fetch("/api/admin/whatsapp/tickets?page=0&size=50", { headers: getAuthHeaders() });
    const data = await res.json();
    if (data.success) {
      const container = document.getElementById("ticketListContainer");
      container.innerHTML = "";

      data.data.content.forEach(t => {
        const div = document.createElement("div");
        div.className = "admin-ticket";
        div.style.cursor = "pointer";
        div.onclick = () => openTicketChat(t.id, t.senderPhone, t.relatedReferenceCode, t.status);

        div.innerHTML = `
          <div style="display: flex; justify-content: space-between; font-weight: 700;">
            <span>${escapeHtml(t.senderPhone)}</span>
            <span class="badge badge-pending">${escapeHtml(t.status)}</span>
          </div>
          <div style="font-size: 0.8rem; color: var(--accent-gold); margin-top: 0.2rem;">
            ${escapeHtml(t.relatedReferenceCode || "General Support")}
          </div>
        `;
        container.appendChild(div);
      });
    }
  } catch (e) {
    console.error("Tickets error", e);
  }
}

async function openTicketChat(id, phone, ref, status) {
  activeTicketId = id;
  document.getElementById("chatSenderPhone").textContent = phone;
  document.getElementById("chatRefCode").textContent = ref || "No Reference";
  document.getElementById("chatStatusBadge").textContent = status;

  try {
    const res = await fetch("/api/admin/whatsapp/tickets/" + id + "/messages", { headers: getAuthHeaders() });
    const data = await res.json();
    if (data.success) {
      const area = document.getElementById("chatMessagesArea");
      area.innerHTML = "";

      data.data.forEach(m => {
        const bubble = document.createElement("div");
        const isAdmin = m.senderType === "ADMIN";
        bubble.style.alignSelf = isAdmin ? "flex-end" : "flex-start";
        bubble.style.maxWidth = "70%";
        bubble.style.padding = "0.65rem 1rem";
        bubble.style.borderRadius = "12px";
        bubble.style.backgroundColor = isAdmin ? "var(--accent-indigo)" : "var(--bg-card)";
        bubble.style.border = "1px solid var(--border-color)";

        bubble.innerHTML = `
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.2rem;">${escapeHtml(m.senderType)}</div>
          <div>${escapeHtml(m.messageBody || "")}</div>
          ${m.mediaUrl ? `<div style="margin-top: 0.5rem;"><a href="${safeExternalUrl(m.mediaUrl)}" target="_blank" style="color: #60a5fa; font-weight: 600;">[Attached Proof / Screenshot]</a></div>` : ''}
          <div style="font-size: 0.7rem; color: var(--text-secondary); text-align: right; margin-top: 0.3rem;">
            ${new Date(m.createdAt).toLocaleTimeString()}
          </div>
        `;
        area.appendChild(bubble);
      });
      area.scrollTop = area.scrollHeight;
    }
  } catch (e) {
    console.error("Messages load error", e);
  }
}

async function sendWhatsAppReply() {
  if (!activeTicketId) {
    alert("Select a ticket first");
    return;
  }
  const txt = document.getElementById("adminReplyInput").value;
  if (!txt) return;

  try {
    const res = await fetch("/api/admin/whatsapp/tickets/" + activeTicketId + "/reply", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ messageBody: txt })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById("adminReplyInput").value = "";
      openTicketChat(activeTicketId, document.getElementById("chatSenderPhone").textContent,
                     document.getElementById("chatRefCode").textContent, "IN_PROGRESS");
    }
  } catch (e) {
    alert("Error sending WhatsApp reply");
  }
}

// ----------------------------------------------------
// AML Alerts & Fraud Flags
// ----------------------------------------------------
async function loadAml() {
  try {
    const resAlerts = await fetch("/api/admin/compliance/aml-alerts", { headers: getAuthHeaders() });
    const dataAlerts = await resAlerts.json();
    if (dataAlerts.success) {
      const container = document.getElementById("amlAlertsList");
      container.innerHTML = "";
      dataAlerts.data.forEach(a => {
        const d = document.createElement("div");
        d.className = "card";
        d.style.marginBottom = "0.5rem";
        d.style.backgroundColor = "rgba(244, 63, 94, 0.05)";
        d.style.borderColor = "rgba(244, 63, 94, 0.3)";
        d.innerHTML = `
          <div style="font-weight: 700; color: var(--accent-rose);">${escapeHtml(a.alertType)}</div>
          <div style="font-size: 0.85rem; margin-top: 0.2rem;">${escapeHtml(a.details)}</div>
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.4rem;">
            User ID: ${escapeHtml(a.user?.id)} | Amount: ₹${a.triggerAmount} | ${new Date(a.createdAt).toLocaleString()}
          </div>
        `;
        container.appendChild(d);
      });
    }

    const resFlags = await fetch("/api/admin/compliance/fraud-flags", { headers: getAuthHeaders() });
    const dataFlags = await resFlags.json();
    if (dataFlags.success) {
      const container = document.getElementById("fraudFlagsList");
      container.innerHTML = "";
      dataFlags.data.forEach(f => {
        const d = document.createElement("div");
        d.className = "card";
        d.style.marginBottom = "0.5rem";
        d.style.backgroundColor = "rgba(245, 158, 11, 0.05)";
        d.style.borderColor = "rgba(245, 158, 11, 0.3)";
        d.innerHTML = `
          <div style="font-weight: 700; color: var(--accent-gold);">${escapeHtml(f.flagType)} (${escapeHtml(f.severity)})</div>
          <div style="font-size: 0.85rem; margin-top: 0.2rem;">${escapeHtml(f.description)}</div>
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.4rem;">
            User ID: ${escapeHtml(f.user?.id)} | ${new Date(f.createdAt).toLocaleString()}
          </div>
        `;
        container.appendChild(d);
      });
    }
  } catch (e) {
    console.error("AML load error", e);
  }
}

// ----------------------------------------------------
// Audit Logs
// ----------------------------------------------------
async function loadAuditLogs() {
  try {
    const res = await fetch("/api/admin/audit-logs?page=0&size=50", { headers: getAuthHeaders() });
    const data = await res.json();
    if (data.success) {
      const tbody = document.getElementById("auditTableBody");
      tbody.innerHTML = "";
      data.data.content.forEach(log => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td style="font-size: 0.8rem;">${new Date(log.createdAt).toLocaleString()}</td>
          <td><b>${escapeHtml(log.actorUsername)}</b></td>
          <td><span class="badge badge-verified">${escapeHtml(log.actorRole)}</span></td>
          <td><code>${escapeHtml(log.action)}</code></td>
          <td>${escapeHtml(log.targetEntity)}: ${escapeHtml(log.targetId)}</td>
          <td style="font-size: 0.85rem;">${escapeHtml(log.reason || "-")}</td>
        `;
        tbody.appendChild(tr);
      });
    }
  } catch (e) {
    console.error("Audit log error", e);
  }
}

function adminLogout() {
  localStorage.removeItem("rmg_admin_token");
  localStorage.removeItem("rmg_token");
  window.location.href = "/";
}
