package com.gaming.platform.module.payment.service;

import com.gaming.platform.common.exception.BusinessException;
import com.gaming.platform.module.compliance.service.AmlService;
import com.gaming.platform.module.payment.dto.DepositCreateRequest;
import com.gaming.platform.module.payment.dto.DepositCreateResponse;
import com.gaming.platform.module.payment.dto.WithdrawalCreateRequest;
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

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

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

    @Value("${rmg.whatsapp.official-upi-id:rmgfinance@icici}")
    private String officialUpiId;

    @Value("${rmg.whatsapp.official-bank-name:HDFC Bank}")
    private String officialBankName;

    @Value("${rmg.whatsapp.official-account-no:50200012345678}")
    private String officialAccountNo;

    @Value("${rmg.whatsapp.official-ifsc:HDFC0001234}")
    private String officialIfsc;

    @Transactional
    public DepositCreateResponse createDepositRequest(Long userId, DepositCreateRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("User not found"));

        if (user.isFrozen()) {
            throw new BusinessException("Account is frozen. Cannot deposit funds.");
        }

        // Enforce AML deposit velocity and limit surveillance
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

        // Build pre-filled WhatsApp click-to-chat deep-link
        String sanitizedPhone = officialWhatsAppNumber.replace("+", "").replace(" ", "").replace("-", "");
        String prefilledMessage = String.format("Hello Admin, I have initiated a deposit of ₹%s on RMG Platform.\nReference Code: %s\nAttached is my payment screenshot/UTR.",
                request.getAmount(), referenceCode);
        String whatsAppLink = "https://wa.me/" + sanitizedPhone + "?text=" + URLEncoder.encode(prefilledMessage, StandardCharsets.UTF_8);

        // Standard UPI Intent QR string
        String qrCodeString = String.format("upi://pay?pa=%s&pn=RMGPlatform&am=%s&tn=%s&cu=INR",
                officialUpiId, request.getAmount(), referenceCode);

        // Pre-create tracking ticket for WhatsApp queue
        WhatsAppTicket ticket = WhatsAppTicket.builder()
                .ticketNumber("TKT-" + timestamp)
                .user(user)
                .senderPhone(user.getPhoneNumber())
                .relatedReferenceCode(referenceCode)
                .ticketType(WhatsAppTicket.TicketType.PAYMENT_VERIFICATION)
                .status(WhatsAppTicket.TicketStatus.OPEN)
                .build();
        ticketRepository.save(ticket);

        return DepositCreateResponse.builder()
                .depositId(deposit.getId())
                .referenceCode(referenceCode)
                .amount(deposit.getAmount())
                .officialUpiId(officialUpiId)
                .officialBankName(officialBankName)
                .officialAccountNo(officialAccountNo)
                .officialIfsc(officialIfsc)
                .whatsAppLink(whatsAppLink)
                .qrCodeString(qrCodeString)
                .instructions("1. Transfer ₹" + request.getAmount() + " via UPI or Bank IMPS to the details above.\n" +
                        "2. Note down your Bank Reference / UTR Number.\n" +
                        "3. Click the WhatsApp button to send your payment screenshot and UTR to our official number.\n" +
                        "4. Your funds will be credited automatically upon verification.")
                .createdAt(deposit.getCreatedAt())
                .build();
    }

    @Transactional
    public WithdrawalResponse requestWithdrawal(Long userId, WithdrawalCreateRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("User not found"));

        // Enforce AML Wagering Turnover, KYC verification, and transaction thresholds
        amlService.validateWithdrawalCompliance(userId, request.getAmount());

        long timestamp = Instant.now().getEpochSecond();
        String referenceCode = "WDR-" + userId + "-" + timestamp;
        String idempotencyKey = "WDR-LOCK-" + referenceCode;

        // Double-entry lock: deducts from winnings_balance and moves to locked_balance
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

        // Create Admin verification ticket
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
    public List<DepositRequest> getUserDeposits(Long userId) {
        return depositRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    @Transactional(readOnly = true)
    public List<WithdrawalRequest> getUserWithdrawals(Long userId) {
        return withdrawalRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }
}
