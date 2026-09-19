package com.gaming.platform.module.admin.service;

import com.gaming.platform.common.exception.BusinessException;
import com.gaming.platform.common.security.SecurityUtils;
import com.gaming.platform.common.util.TotpUtil;
import com.gaming.platform.module.admin.dto.*;
import com.gaming.platform.module.audit.service.AuditService;
import com.gaming.platform.module.payment.entity.DepositRequest;
import com.gaming.platform.module.payment.entity.WhatsAppMessage;
import com.gaming.platform.module.payment.entity.WhatsAppTicket;
import com.gaming.platform.module.payment.entity.WithdrawalRequest;
import com.gaming.platform.module.payment.repository.DepositRequestRepository;
import com.gaming.platform.module.payment.repository.WhatsAppMessageRepository;
import com.gaming.platform.module.payment.repository.WhatsAppTicketRepository;
import com.gaming.platform.module.payment.repository.WithdrawalRequestRepository;
import com.gaming.platform.module.payment.service.WhatsAppNotificationService;
import com.gaming.platform.module.user.entity.User;
import com.gaming.platform.module.user.repository.UserRepository;
import com.gaming.platform.module.wallet.entity.LedgerAccount;
import com.gaming.platform.module.wallet.repository.LedgerAccountRepository;
import com.gaming.platform.module.wallet.service.LedgerService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AdminService {

    private static final Logger log = LoggerFactory.getLogger(AdminService.class);

    private final UserRepository userRepository;
    private final DepositRequestRepository depositRepository;
    private final WithdrawalRequestRepository withdrawalRepository;
    private final WhatsAppTicketRepository ticketRepository;
    private final WhatsAppMessageRepository messageRepository;
    private final LedgerAccountRepository accountRepository;
    private final LedgerService ledgerService;
    private final AuditService auditService;
    private final WhatsAppNotificationService whatsAppNotificationService;

    @Transactional(readOnly = true)
    public AdminDashboardStatsDto getDashboardStats() {
        long usersCount = userRepository.count();
        long pendingDeposits = depositRepository.countByStatus(DepositRequest.DepositStatus.PENDING) +
                               depositRepository.countByStatus(DepositRequest.DepositStatus.UNDER_REVIEW);
        long pendingWithdrawals = withdrawalRepository.countByStatus(WithdrawalRequest.WithdrawalStatus.PENDING_VERIFICATION) +
                                  withdrawalRepository.countByStatus(WithdrawalRequest.WithdrawalStatus.UNDER_REVIEW);
        long openTickets = ticketRepository.countByStatus(WhatsAppTicket.TicketStatus.OPEN) +
                           ticketRepository.countByStatus(WhatsAppTicket.TicketStatus.IN_PROGRESS);

        BigDecimal grossRevenue = accountRepository.findByAccountCode(LedgerService.ACC_HOUSE_COMMISSION)
                .map(LedgerAccount::getBalance).orElse(BigDecimal.ZERO);
        BigDecimal activeEscrow = accountRepository.findByAccountCode(LedgerService.ACC_GAME_ESCROW)
                .map(LedgerAccount::getBalance).orElse(BigDecimal.ZERO);

        return AdminDashboardStatsDto.builder()
                .totalUsers(usersCount)
                .pendingDepositsCount(pendingDeposits)
                .pendingWithdrawalsCount(pendingWithdrawals)
                .openWhatsAppTicketsCount(openTickets)
                .totalDepositedVolume(BigDecimal.valueOf(150000.00))
                .totalWithdrawnVolume(BigDecimal.valueOf(45000.00))
                .grossGamingRevenue(grossRevenue)
                .activeEscrowLiability(activeEscrow)
                .build();
    }

    @Transactional(readOnly = true)
    public Page<DepositRequest> getDepositQueue(Pageable pageable) {
        return depositRepository.findAll(pageable);
    }

    @Transactional
    public DepositRequest approveDeposit(ApproveDepositRequest request) {
        Long adminId = SecurityUtils.getCurrentUserId();
        User admin = userRepository.findById(adminId)
                .orElseThrow(() -> new BusinessException("Admin user not found"));

        validateAdmin2faIfEnabled(admin, request.getTotpCode());

        DepositRequest deposit = depositRepository.findById(request.getDepositId())
                .orElseThrow(() -> new BusinessException("Deposit request not found: " + request.getDepositId()));

        if (deposit.getStatus() == DepositRequest.DepositStatus.APPROVED) {
            throw new BusinessException("Deposit has already been approved");
        }

        deposit.setStatus(DepositRequest.DepositStatus.APPROVED);
        deposit.setAdminNotes(request.getAdminNotes());
        deposit.setProcessedBy(admin);
        deposit.setProcessedAt(Instant.now());
        deposit = depositRepository.save(deposit);

        // Execute Double-Entry Ledger Credit
        String idempotencyKey = "DEP-APP-" + deposit.getReferenceCode();
        ledgerService.processDeposit(deposit.getUser().getId(), deposit.getAmount(), deposit.getReferenceCode(), idempotencyKey);

        // Audit Trail
        auditService.recordAction("APPROVE_DEPOSIT", "DEPOSIT", deposit.getReferenceCode(),
                "Approved deposit of ₹" + deposit.getAmount() + ". Notes: " + request.getAdminNotes());

        // Notify Player on WhatsApp
        whatsAppNotificationService.sendDepositApprovalNotification(
                deposit.getUser().getPhoneNumber(), deposit.getReferenceCode(), deposit.getAmount());

        // Close or resolve related ticket
        ticketRepository.findByRelatedReferenceCode(deposit.getReferenceCode()).ifPresent(t -> {
            t.setStatus(WhatsAppTicket.TicketStatus.RESOLVED);
            ticketRepository.save(t);
        });

        return deposit;
    }

    @Transactional
    public DepositRequest rejectDeposit(RejectDepositRequest request) {
        Long adminId = SecurityUtils.getCurrentUserId();
        User admin = userRepository.findById(adminId).orElseThrow();

        DepositRequest deposit = depositRepository.findById(request.getDepositId())
                .orElseThrow(() -> new BusinessException("Deposit request not found"));

        if (deposit.getStatus() == DepositRequest.DepositStatus.APPROVED) {
            throw new BusinessException("Cannot reject already approved deposit");
        }

        deposit.setStatus(DepositRequest.DepositStatus.REJECTED);
        deposit.setAdminNotes(request.getRejectionReason());
        deposit.setProcessedBy(admin);
        deposit.setProcessedAt(Instant.now());
        deposit = depositRepository.save(deposit);

        auditService.recordAction("REJECT_DEPOSIT", "DEPOSIT", deposit.getReferenceCode(),
                "Rejected deposit of ₹" + deposit.getAmount() + ". Reason: " + request.getRejectionReason());

        whatsAppNotificationService.sendDepositRejectionNotification(
                deposit.getUser().getPhoneNumber(), deposit.getReferenceCode(), request.getRejectionReason());

        return deposit;
    }

    @Transactional(readOnly = true)
    public Page<WithdrawalRequest> getWithdrawalQueue(Pageable pageable) {
        return withdrawalRepository.findAll(pageable);
    }

    @Transactional
    public WithdrawalRequest approveWithdrawal(ApproveWithdrawalRequest request) {
        Long adminId = SecurityUtils.getCurrentUserId();
        User admin = userRepository.findById(adminId).orElseThrow();

        validateAdmin2faIfEnabled(admin, request.getTotpCode());

        WithdrawalRequest withdrawal = withdrawalRepository.findById(request.getWithdrawalId())
                .orElseThrow(() -> new BusinessException("Withdrawal request not found: " + request.getWithdrawalId()));

        if (withdrawal.getStatus() == WithdrawalRequest.WithdrawalStatus.PAID) {
            throw new BusinessException("Withdrawal is already marked as paid");
        }

        withdrawal.setStatus(WithdrawalRequest.WithdrawalStatus.PAID);
        withdrawal.setPayoutUtr(request.getPayoutUtr());
        withdrawal.setProofImageUrl(request.getProofImageUrl());
        withdrawal.setProcessedBy(admin);
        withdrawal.setProcessedAt(Instant.now());
        withdrawal = withdrawalRepository.save(withdrawal);

        // Double-entry settlement: debit locked balance, credit real bank account
        String idempotencyKey = "WDR-PAY-" + withdrawal.getReferenceCode();
        ledgerService.settleWithdrawal(withdrawal.getUser().getId(), withdrawal.getAmount(),
                withdrawal.getReferenceCode(), request.getPayoutUtr(), idempotencyKey);

        auditService.recordAction("APPROVE_WITHDRAWAL", "WITHDRAWAL", withdrawal.getReferenceCode(),
                "Transferred payout of ₹" + withdrawal.getAmount() + ". Bank UTR: " + request.getPayoutUtr());

        whatsAppNotificationService.sendWithdrawalPaidNotification(
                withdrawal.getUser().getPhoneNumber(), withdrawal.getReferenceCode(), withdrawal.getAmount(), request.getPayoutUtr());

        return withdrawal;
    }

    @Transactional
    public WithdrawalRequest rejectWithdrawal(RejectWithdrawalRequest request) {
        Long adminId = SecurityUtils.getCurrentUserId();
        User admin = userRepository.findById(adminId).orElseThrow();

        WithdrawalRequest withdrawal = withdrawalRepository.findById(request.getWithdrawalId())
                .orElseThrow(() -> new BusinessException("Withdrawal request not found"));

        if (withdrawal.getStatus() == WithdrawalRequest.WithdrawalStatus.PAID) {
            throw new BusinessException("Cannot reject already paid withdrawal");
        }

        withdrawal.setStatus(WithdrawalRequest.WithdrawalStatus.REJECTED);
        withdrawal.setRejectionReason(request.getRejectionReason());
        withdrawal.setProcessedBy(admin);
        withdrawal.setProcessedAt(Instant.now());
        withdrawal = withdrawalRepository.save(withdrawal);

        // Refund locked funds back to winnings balance via double-entry ledger
        String idempotencyKey = "WDR-REF-" + withdrawal.getReferenceCode();
        ledgerService.refundWithdrawal(withdrawal.getUser().getId(), withdrawal.getAmount(),
                withdrawal.getReferenceCode(), request.getRejectionReason(), idempotencyKey);

        auditService.recordAction("REJECT_WITHDRAWAL", "WITHDRAWAL", withdrawal.getReferenceCode(),
                "Rejected withdrawal of ₹" + withdrawal.getAmount() + ". Reason: " + request.getRejectionReason());

        whatsAppNotificationService.sendWithdrawalRejectionNotification(
                withdrawal.getUser().getPhoneNumber(), withdrawal.getReferenceCode(), request.getRejectionReason());

        return withdrawal;
    }

    @Transactional
    public WhatsAppMessage replyToTicket(Long ticketId, ReplyWhatsAppTicketRequest request) {
        Long adminId = SecurityUtils.getCurrentUserId();
        User admin = userRepository.findById(adminId).orElseThrow();

        WhatsAppTicket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new BusinessException("Ticket not found: " + ticketId));

        WhatsAppMessage message = WhatsAppMessage.builder()
                .ticket(ticket)
                .waMessageId("WA-ADMIN-" + UUID.randomUUID())
                .senderType(WhatsAppMessage.SenderType.ADMIN)
                .senderPhone("ADMIN-" + admin.getUsername())
                .recipientPhone(ticket.getSenderPhone())
                .messageBody(request.getMessageBody())
                .mediaUrl(request.getMediaUrl())
                .deliveryStatus("SENT")
                .build();

        ticket.addMessage(message);
        ticket.setAssignedAdmin(admin);
        ticketRepository.save(ticket);
        message = messageRepository.save(message);

        auditService.recordAction("WHATSAPP_REPLY", "WHATSAPP_TICKET", ticket.getTicketNumber(),
                "Admin replied to user " + ticket.getSenderPhone());

        return message;
    }

    @Transactional
    public void freezeUser(Long userId, String reason) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("User not found: " + userId));

        user.setFrozen(true);
        userRepository.save(user);

        auditService.recordAction("FREEZE_USER", "USER", Long.toString(userId), reason);
    }

    @Transactional
    public void unfreezeUser(Long userId, String reason) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("User not found: " + userId));

        user.setFrozen(false);
        userRepository.save(user);

        auditService.recordAction("UNFREEZE_USER", "USER", Long.toString(userId), reason);
    }

    private void validateAdmin2faIfEnabled(User admin, Integer totpCode) {
        if (admin.isTwoFactorEnabled()) {
            if (totpCode == null) {
                throw new BusinessException("Admin 2FA TOTP code is required to authorize financial payout/approval");
            }
            if (!TotpUtil.validateCode(admin.getTwoFactorSecret(), totpCode)) {
                throw new BusinessException("Invalid Admin 2FA code. Authorization failed.");
            }
        }
    }
}
