package com.gaming.platform.module.payment.service;

import com.gaming.platform.common.exception.BusinessException;
import com.gaming.platform.module.compliance.service.AmlService;
import com.gaming.platform.module.payment.dto.DepositCreateRequest;
import com.gaming.platform.module.payment.dto.DepositCreateResponse;
import com.gaming.platform.module.payment.dto.WithdrawalCreateRequest;
import com.gaming.platform.module.payment.dto.UserDepositResponse;
import com.gaming.platform.module.payment.dto.WithdrawalResponse;
import com.gaming.platform.module.payment.entity.DepositRequest;
import com.gaming.platform.module.payment.entity.WhatsAppTicket;
import com.gaming.platform.module.payment.entity.WithdrawalRequest;
import com.gaming.platform.module.payment.repository.DepositRequestRepository;
import com.gaming.platform.module.payment.repository.WhatsAppTicketRepository;
import com.gaming.platform.module.payment.repository.WithdrawalRequestRepository;
import com.gaming.platform.module.user.entity.User;
import com.gaming.platform.module.user.repository.UserRepository;
import com.gaming.platform.module.wallet.service.LedgerService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PaymentService {

    private final DepositRequestRepository depositRepository;
    private final WithdrawalRequestRepository withdrawalRepository;
    private final WhatsAppTicketRepository ticketRepository;
    private final UserRepository userRepository;
    private final LedgerService ledgerService;
    private final AmlService amlService;

    @Value("${rmg.whatsapp.official-number:+919876543210}")
    private String officialWhatsAppNumber;

    @Transactional
    public DepositCreateResponse createDepositRequest(Long userId, DepositCreateRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("User not found"));

        if (user.isFrozen()) {
            throw new BusinessException("Account is frozen. Cannot deposit funds.");
        }

        amlService.inspectDepositAml(userId, request.getAmount());

        long timestamp = Instant.now().getEpochSecond();
        String referenceCode = "DEP-" + userId + "-" + timestamp;

        DepositRequest deposit = DepositRequest.builder()
                .referenceCode(referenceCode)
                .user(user)
                .amount(request.getAmount())
                .paymentMethod(request.getPaymentMethod())
                .status(DepositRequest.DepositStatus.PENDING)
                .build();
        deposit = depositRepository.save(deposit);

        String sanitizedPhone = officialWhatsAppNumber.replace("+", "").replace(" ", "").replace("-", "");
        String prefilledMessage = String.format(
                "Hello, I have made a payment of ₹%s.\nReference Code: %s\nUTR: ",
                request.getAmount(), referenceCode);
        String whatsAppLink = "https://wa.me/" + sanitizedPhone + "?text=" +
                java.net.URLEncoder.encode(prefilledMessage, StandardCharsets.UTF_8);

        return DepositCreateResponse.builder()
                .depositId(deposit.getId())
                .referenceCode(referenceCode)
                .amount(deposit.getAmount())
                .whatsAppLink(whatsAppLink)
                .instructions("1. Pay the displayed amount using the UPI QR or UPI ID.\n" +
                        "2. Copy the 12-digit UTR from your payment receipt.\n" +
                        "3. Enter the UTR on this page and submit it.\n" +
                        "4. Send the payment proof on WhatsApp. An admin will manually verify and approve the deposit.")
                .createdAt(deposit.getCreatedAt())
                .build();
    }

    @Transactional
    public DepositCreateResponse submitDepositUtr(Long userId, Long depositId, String utrNumber) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("User not found"));

        DepositRequest deposit = depositRepository.findById(depositId)
                .orElseThrow(() -> new BusinessException("Deposit request not found"));

        if (!deposit.getUser().getId().equals(user.getId())) {
            throw new BusinessException("You are not allowed to update this deposit request");
        }
        if (deposit.getStatus() == DepositRequest.DepositStatus.APPROVED) {
            throw new BusinessException("Deposit has already been approved");
        }
        if (deposit.getStatus() == DepositRequest.DepositStatus.REJECTED ||
                deposit.getStatus() == DepositRequest.DepositStatus.EXPIRED) {
            throw new BusinessException("This deposit request is no longer active");
        }

        deposit.setUtrNumber(utrNumber);
        deposit.setStatus(DepositRequest.DepositStatus.UNDER_REVIEW);
        deposit = depositRepository.save(deposit);

        String sanitizedPhone = officialWhatsAppNumber.replace("+", "").replace(" ", "").replace("-", "");
        String message = String.format(
                "Hello, I have made a payment of ₹%s.\nReference Code: %s\nUTR: %s",
                deposit.getAmount(), deposit.getReferenceCode(), utrNumber);
        String whatsAppLink = "https://wa.me/" + sanitizedPhone + "?text=" +
                java.net.URLEncoder.encode(message, StandardCharsets.UTF_8);

        return DepositCreateResponse.builder()
                .depositId(deposit.getId())
                .referenceCode(deposit.getReferenceCode())
                .amount(deposit.getAmount())
                .whatsAppLink(whatsAppLink)
                .instructions("Deposit submitted for manual verification.")
                .createdAt(deposit.getCreatedAt())
                .build();
    }

    @Transactional
    public WithdrawalResponse requestWithdrawal(Long userId, WithdrawalCreateRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("User not found"));

        amlService.validateWithdrawalCompliance(userId, request.getAmount());

        long timestamp = Instant.now().getEpochSecond();
        String referenceCode = "WDR-" + userId + "-" + timestamp;
        String idempotencyKey = "WDR-LOCK-" + referenceCode;

        ledgerService.lockFundsForWithdrawal(userId, request.getAmount(), referenceCode, idempotencyKey);

        WithdrawalRequest withdrawal = WithdrawalRequest.builder()
                .referenceCode(referenceCode)
                .user(user)
                .amount(request.getAmount())
                .destinationType(request.getDestinationType())
                .accountHolderName(request.getAccountHolderName())
                .accountNumberOrVpa(request.getAccountNumberOrVpa())
                .ifscCode(request.getIfscCode())
                .bankName(request.getBankName())
                .status(WithdrawalRequest.WithdrawalStatus.PENDING_VERIFICATION)
                .build();
        withdrawal = withdrawalRepository.save(withdrawal);

        WhatsAppTicket ticket = WhatsAppTicket.builder()
                .ticketNumber("TKT-WDR-" + timestamp)
                .user(user)
                .senderPhone(user.getPhoneNumber())
                .relatedReferenceCode(referenceCode)
                .ticketType(WhatsAppTicket.TicketType.WITHDRAWAL_INQUIRY)
                .status(WhatsAppTicket.TicketStatus.OPEN)
                .build();
        ticketRepository.save(ticket);

        return WithdrawalResponse.builder()
                .withdrawalId(withdrawal.getId())
                .referenceCode(referenceCode)
                .amount(withdrawal.getAmount())
                .status(withdrawal.getStatus())
                .destinationType(withdrawal.getDestinationType())
                .accountHolderName(withdrawal.getAccountHolderName())
                .accountNumberOrVpa(withdrawal.getAccountNumberOrVpa())
                .createdAt(withdrawal.getCreatedAt())
                .build();
    }

    @Transactional(readOnly = true)
    public List<UserDepositResponse> getUserDeposits(Long userId) {
        return depositRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(deposit -> UserDepositResponse.builder()
                        .id(deposit.getId())
                        .referenceCode(deposit.getReferenceCode())
                        .amount(deposit.getAmount())
                        .status(deposit.getStatus())
                        .paymentMethod(deposit.getPaymentMethod())
                        .utrNumber(deposit.getUtrNumber())
                        .adminNotes(deposit.getAdminNotes())
                        .processedAt(deposit.getProcessedAt())
                        .createdAt(deposit.getCreatedAt())
                        .updatedAt(deposit.getUpdatedAt())
                        .build())
                .toList();
    }

    @Transactional(readOnly = true)
    public List<WithdrawalRequest> getUserWithdrawals(Long userId) {
        return withdrawalRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }
}
