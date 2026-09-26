package com.gaming.platform.module.admin.controller;

import com.gaming.platform.common.response.ApiResponse;
import com.gaming.platform.common.security.SecurityUtils;
import com.gaming.platform.module.admin.dto.*;
import com.gaming.platform.module.admin.service.AdminService;
import com.gaming.platform.module.audit.entity.AuditLog;
import com.gaming.platform.module.audit.repository.AuditLogRepository;
import com.gaming.platform.module.compliance.entity.AmlAlert;
import com.gaming.platform.module.compliance.entity.FraudFlag;
import com.gaming.platform.module.compliance.repository.AmlAlertRepository;
import com.gaming.platform.module.compliance.repository.FraudFlagRepository;
import com.gaming.platform.module.payment.entity.DepositRequest;
import com.gaming.platform.module.payment.entity.WhatsAppMessage;
import com.gaming.platform.module.payment.entity.WhatsAppTicket;
import com.gaming.platform.module.payment.entity.WithdrawalRequest;
import com.gaming.platform.module.payment.repository.WhatsAppMessageRepository;
import com.gaming.platform.module.payment.repository.WhatsAppTicketRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'FINANCE', 'SUPPORT')")
@RequiredArgsConstructor
@Tag(name = "Admin & Compliance Management", description = "Management dashboard, payment approvals, WhatsApp inbox, AML/fraud monitoring, and audit logs")
public class AdminController {

    private final AdminService adminService;
    private final WhatsAppTicketRepository ticketRepository;
    private final WhatsAppMessageRepository messageRepository;
    private final AuditLogRepository auditLogRepository;
    private final AmlAlertRepository amlAlertRepository;
    private final FraudFlagRepository fraudFlagRepository;

    @GetMapping("/dashboard")
    @Operation(summary = "Get high-level admin dashboard statistics and financial floats")
    public ResponseEntity<ApiResponse<AdminDashboardStatsDto>> getDashboard() {
        return ResponseEntity.ok(ApiResponse.ok(adminService.getDashboardStats()));
    }

    @GetMapping("/deposits")
    @Operation(summary = "Get manual deposit queue awaiting review or approval")
    public ResponseEntity<ApiResponse<Page<DepositRequest>>> getDeposits(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<DepositRequest> list = adminService.getDepositQueue(PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        return ResponseEntity.ok(ApiResponse.ok(list));
    }

    @PostMapping("/deposits/approve")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'FINANCE')")
    @Operation(summary = "Approve deposit and credit user wallet via double-entry ledger")
    public ResponseEntity<ApiResponse<DepositRequest>> approveDeposit(@Valid @RequestBody ApproveDepositRequest request) {
        DepositRequest approved = adminService.approveDeposit(request);
        return ResponseEntity.ok(ApiResponse.ok("Deposit approved and credited", approved));
    }

    @PostMapping("/deposits/reject")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'FINANCE')")
    @Operation(summary = "Reject invalid deposit request and notify user")
    public ResponseEntity<ApiResponse<DepositRequest>> rejectDeposit(@Valid @RequestBody RejectDepositRequest request) {
        DepositRequest rejected = adminService.rejectDeposit(request);
        return ResponseEntity.ok(ApiResponse.ok("Deposit rejected", rejected));
    }

    @GetMapping("/withdrawals")
    @Operation(summary = "Get withdrawal queue awaiting manual transfer")
    public ResponseEntity<ApiResponse<Page<WithdrawalRequest>>> getWithdrawals(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<WithdrawalRequest> list = adminService.getWithdrawalQueue(PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        return ResponseEntity.ok(ApiResponse.ok(list));
    }

    @PostMapping("/withdrawals/approve")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'FINANCE')")
    @Operation(summary = "Mark withdrawal paid with UTR and debit locked funds via ledger")
    public ResponseEntity<ApiResponse<WithdrawalRequest>> approveWithdrawal(@Valid @RequestBody ApproveWithdrawalRequest request) {
        WithdrawalRequest paid = adminService.approveWithdrawal(request);
        return ResponseEntity.ok(ApiResponse.ok("Withdrawal settled and marked as paid", paid));
    }

    @PostMapping("/withdrawals/reject")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'FINANCE')")
    @Operation(summary = "Reject withdrawal and refund locked funds back to player winnings balance")
    public ResponseEntity<ApiResponse<WithdrawalRequest>> rejectWithdrawal(@Valid @RequestBody RejectWithdrawalRequest request) {
        WithdrawalRequest rejected = adminService.rejectWithdrawal(request);
        return ResponseEntity.ok(ApiResponse.ok("Withdrawal rejected and funds refunded", rejected));
    }

    @GetMapping("/whatsapp/tickets")
    @Operation(summary = "Get WhatsApp tickets and verification chat inbox")
    public ResponseEntity<ApiResponse<Page<WhatsAppTicket>>> getTickets(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<WhatsAppTicket> tickets = ticketRepository.findAll(PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "lastMessageAt")));
        return ResponseEntity.ok(ApiResponse.ok(tickets));
    }

    @GetMapping("/whatsapp/tickets/{ticketId}/messages")
    @Operation(summary = "Get conversation history for a specific WhatsApp ticket")
    public ResponseEntity<ApiResponse<List<WhatsAppMessage>>> getMessages(@PathVariable Long ticketId) {
        List<WhatsAppMessage> messages = messageRepository.findByTicketIdOrderByCreatedAtAsc(ticketId);
        return ResponseEntity.ok(ApiResponse.ok(messages));
    }

    @PostMapping("/whatsapp/tickets/{ticketId}/reply")
    @Operation(summary = "Send an admin reply message to user's WhatsApp ticket")
    public ResponseEntity<ApiResponse<WhatsAppMessage>> replyToTicket(
            @PathVariable Long ticketId,
            @Valid @RequestBody ReplyWhatsAppTicketRequest request) {
        WhatsAppMessage message = adminService.replyToTicket(ticketId, request);
        return ResponseEntity.ok(ApiResponse.ok("Reply sent", message));
    }

    @PostMapping("/users/{userId}/freeze")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    @Operation(summary = "Freeze user account due to compliance or fraud flag")
    public ResponseEntity<ApiResponse<Void>> freezeUser(@PathVariable Long userId, @Valid @RequestBody UserActionRequest request) {
        adminService.freezeUser(userId, request.getReason());
        return ResponseEntity.ok(ApiResponse.ok("User frozen successfully", null));
    }

    @PostMapping("/users/{userId}/unfreeze")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    @Operation(summary = "Unfreeze user account after review")
    public ResponseEntity<ApiResponse<Void>> unfreezeUser(@PathVariable Long userId, @Valid @RequestBody UserActionRequest request) {
        adminService.unfreezeUser(userId, request.getReason());
        return ResponseEntity.ok(ApiResponse.ok("User unfrozen successfully", null));
    }

    @GetMapping("/audit-logs")
    @Operation(summary = "View full immutable audit logs of administrative actions")
    public ResponseEntity<ApiResponse<Page<AuditLog>>> getAuditLogs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        Page<AuditLog> logs = auditLogRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(page, size));
        return ResponseEntity.ok(ApiResponse.ok(logs));
    }

    @GetMapping("/compliance/aml-alerts")
    @Operation(summary = "Get AML transaction monitoring surveillance alerts")
    public ResponseEntity<ApiResponse<List<AmlAlert>>> getAmlAlerts() {
        List<AmlAlert> alerts = amlAlertRepository.findByStatusOrderByCreatedAtDesc(AmlAlert.AlertStatus.NEW);
        return ResponseEntity.ok(ApiResponse.ok(alerts));
    }

    @GetMapping("/compliance/fraud-flags")
    @Operation(summary = "Get unresolved user fraud flags")
    public ResponseEntity<ApiResponse<List<FraudFlag>>> getFraudFlags() {
        List<FraudFlag> flags = fraudFlagRepository.findByResolvedFalseOrderByCreatedAtDesc();
        return ResponseEntity.ok(ApiResponse.ok(flags));
    }
}