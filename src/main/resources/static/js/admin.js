// Admin Console JavaScript Controller
let adminToken = localStorage.getItem("rmg_admin_token") || localStorage.getItem("rmg_token");
let activeTicketId = null;

document.addEventListener("DOMContentLoaded", () => {
  loadDashboard();
  loadDeposits();
  loadWithdrawals();
  loadTickets();
  loadAml();
  loadAuditLogs();
});

function switchAdminTab(tabId) {
  document.querySelectorAll(".admin-tab").forEach(el => el.style.display = "none");
  document.querySelectorAll(".tab-btn").forEach(el => el.classList.remove("active"));

  const target = document.getElementById("adm-tab-" + tabId);
  if (target) target.style.display = "block";

  const btn = Array.from(document.querySelectorAll(".tab-btn")).find(b => b.getAttribute("onclick").includes(tabId));
  if (btn) btn.classList.add("active");

  if (tabId === "deposits") loadDeposits();
  if (tabId === "withdrawals") loadWithdrawals();
  if (tabId === "whatsapp") loadTickets();
  if (tabId === "aml") loadAml();
  if (tabId === "audit") loadAuditLogs();
}

function openModal(id) {
  document.getElementById(id)?.classList.add("active");
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove("active");
}

function getAuthHeaders() {
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
  try {
    const res = await fetch("/api/admin/deposits?page=0&size=50", { headers: getAuthHeaders() });
    const data = await res.json();
    if (data.success) {
      const tbody = document.getElementById("depositsTableBody");
      tbody.innerHTML = "";

      data.data.content.forEach(dep => {
        const tr = document.createElement("tr");
        const statusBadge = dep.status === "APPROVED" ? "badge-approved" : (dep.status === "REJECTED" ? "badge-rejected" : "badge-pending");

        tr.innerHTML = `
          <td><b style="color: var(--accent-gold);">${dep.referenceCode}</b></td>
          <td>${dep.user.phoneNumber}</td>
          <td><b>₹${Number(dep.amount).toFixed(2)}</b></td>
          <td><span class="badge ${statusBadge}">${dep.status}</span></td>
          <td>
            ${dep.utrNumber ? `<div style="font-size: 0.8rem;">UTR: <b>${dep.utrNumber}</b></div>` : ''}
            ${dep.proofImageUrl ? `<a href="${dep.proofImageUrl}" target="_blank" style="color: #60a5fa; font-size: 0.8rem;">View Screenshot</a>` : 'No proof attached'}
          </td>
          <td>${new Date(dep.createdAt).toLocaleString()}</td>
          <td>
            ${dep.status !== 'APPROVED' ? `
              <button class="btn btn-success" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;" onclick="approveDeposit(${dep.id})">Approve</button>
              <button class="btn btn-danger" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;" onclick="rejectDeposit(${dep.id})">Reject</button>
            ` : '<span style="color: var(--accent-emerald);">Credited ✓</span>'}
          </td>
        `;
        tbody.appendChild(tr);
      });
    }
  } catch (e) {
    console.error("Deposits load error", e);
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
      alert("Deposit approved! Double-entry ledger credit posted and WhatsApp message sent to user.");
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
          <td><b style="color: var(--accent-gold);">${wdr.referenceCode}</b></td>
          <td>${wdr.user.phoneNumber} (${wdr.accountHolderName})</td>
          <td><b>₹${Number(wdr.amount).toFixed(2)}</b></td>
          <td>${wdr.destinationType}</td>
          <td><code>${wdr.accountNumberOrVpa}</code></td>
          <td><span class="badge ${statusBadge}">${wdr.status}</span></td>
          <td>
            ${wdr.status !== 'PAID' && wdr.status !== 'REJECTED' ? `
              <button class="btn btn-success" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;" onclick="openPayoutModal(${wdr.id})">Mark Paid</button>
              <button class="btn btn-danger" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;" onclick="rejectWithdrawal(${wdr.id})">Reject</button>
            ` : (wdr.status === 'PAID' ? `<span style="color: var(--accent-emerald);">UTR: ${wdr.payoutUtr}</span>` : 'Refunded')}
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
        div.className = "balance-chip";
        div.style.cursor = "pointer";
        div.onclick = () => openTicketChat(t.id, t.senderPhone, t.relatedReferenceCode, t.status);

        div.innerHTML = `
          <div style="display: flex; justify-content: space-between; font-weight: 700;">
            <span>${t.senderPhone}</span>
            <span class="badge badge-pending">${t.status}</span>
          </div>
          <div style="font-size: 0.8rem; color: var(--accent-gold); margin-top: 0.2rem;">
            ${t.relatedReferenceCode || 'General Support'}
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
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.2rem;">${m.senderType}</div>
          <div>${m.messageBody || ''}</div>
          ${m.mediaUrl ? `<div style="margin-top: 0.5rem;"><a href="${m.mediaUrl}" target="_blank" style="color: #60a5fa; font-weight: 600;">[Attached Proof / Screenshot]</a></div>` : ''}
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
          <div style="font-weight: 700; color: var(--accent-rose);">${a.alertType}</div>
          <div style="font-size: 0.85rem; margin-top: 0.2rem;">${a.details}</div>
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.4rem;">
            User ID: ${a.user.id} | Amount: ₹${a.triggerAmount} | ${new Date(a.createdAt).toLocaleString()}
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
          <div style="font-weight: 700; color: var(--accent-gold);">${f.flagType} (${f.severity})</div>
          <div style="font-size: 0.85rem; margin-top: 0.2rem;">${f.description}</div>
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.4rem;">
            User ID: ${f.user.id} | ${new Date(f.createdAt).toLocaleString()}
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
          <td><b>${log.actorUsername}</b></td>
          <td><span class="badge badge-verified">${log.actorRole}</span></td>
          <td><code>${log.action}</code></td>
          <td>${log.targetEntity}: ${log.targetId}</td>
          <td style="font-size: 0.85rem;">${log.reason || '-'}</td>
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
