package com.gaming.platform.module.payment.service;

import com.gaming.platform.module.payment.entity.WhatsAppMessage;
import com.gaming.platform.module.payment.entity.WhatsAppTicket;
import com.gaming.platform.module.payment.repository.WhatsAppMessageRepository;
import com.gaming.platform.module.payment.repository.WhatsAppTicketRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class WhatsAppNotificationService {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppNotificationService.class);

    private final WhatsAppTicketRepository ticketRepository;
    private final WhatsAppMessageRepository messageRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @Value("${rmg.whatsapp.official-number:+919876543210}")
    private String officialWhatsAppNumber;

    @Transactional
    public void sendDepositApprovalNotification(String recipientPhone, String referenceCode, BigDecimal amount) {
        String body = String.format("🎉 *Deposit Confirmed!*\n\nYour deposit of *₹%s* for Reference Code *%s* has been verified by our finance team and credited to your wallet deposit balance.\n\nGood luck playing!",
                amount, referenceCode);
        dispatchOutbound(recipientPhone, referenceCode, body);
    }

    @Transactional
    public void sendDepositRejectionNotification(String recipientPhone, String referenceCode, String reason) {
        String body = String.format("⚠️ *Deposit Verification Update*\n\nYour deposit for Reference *%s* could not be verified.\nReason: %s\n\nPlease check your bank statement and reply here with valid UTR / payment receipt screenshot.",
                referenceCode, reason);
        dispatchOutbound(recipientPhone, referenceCode, body);
    }

    @Transactional
    public void sendWithdrawalPaidNotification(String recipientPhone, String referenceCode, BigDecimal amount, String utr) {
        String body = String.format("✅ *Withdrawal Paid!*\n\nYour withdrawal of *₹%s* (Ref: *%s*) has been transferred to your bank/UPI.\n*Bank UTR*: `%s`.\n\nFunds should reflect in your account immediately.",
                amount, referenceCode, utr);
        dispatchOutbound(recipientPhone, referenceCode, body);
    }

    @Transactional
    public void sendWithdrawalRejectionNotification(String recipientPhone, String referenceCode, String reason) {
        String body = String.format("❌ *Withdrawal Rejected*\n\nYour withdrawal request *%s* was rejected.\nReason: %s\n\nYour funds have been safely returned to your winnings wallet balance.",
                referenceCode, reason);
        dispatchOutbound(recipientPhone, referenceCode, body);
    }

    @Transactional
    public void dispatchOutbound(String recipientPhone, String referenceCode, String body) {
        log.info("Sending WhatsApp message to {}: {}", recipientPhone, body);

        // Find or create ticket for this user phone
        WhatsAppTicket ticket = ticketRepository.findFirstBySenderPhoneAndStatusNotOrderByLastMessageAtDesc(
                recipientPhone, WhatsAppTicket.TicketStatus.CLOSED
        ).orElseGet(() -> {
            WhatsAppTicket newTicket = WhatsAppTicket.builder()
                    .ticketNumber("TKT-" + System.currentTimeMillis())
                    .senderPhone(recipientPhone)
                    .relatedReferenceCode(referenceCode)
                    .ticketType(WhatsAppTicket.TicketType.PAYMENT_VERIFICATION)
                    .status(WhatsAppTicket.TicketStatus.IN_PROGRESS)
                    .build();
            return ticketRepository.save(newTicket);
        });

        WhatsAppMessage message = WhatsAppMessage.builder()
                .ticket(ticket)
                .waMessageId("WA-OUT-" + UUID.randomUUID())
                .senderType(WhatsAppMessage.SenderType.SYSTEM)
                .senderPhone(officialWhatsAppNumber)
                .recipientPhone(recipientPhone)
                .messageBody(body)
                .deliveryStatus("SENT")
                .build();

        ticket.addMessage(message);
        messageRepository.save(message);
        ticketRepository.save(ticket);

        // Push real-time update to Admin UI and player topic via STOMP WebSocket
        messagingTemplate.convertAndSend("/topic/whatsapp/tickets", ticket);
    }
}
