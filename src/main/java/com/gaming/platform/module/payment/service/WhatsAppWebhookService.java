package com.gaming.platform.module.payment.service;

import com.gaming.platform.module.payment.dto.WhatsAppInboundWebhookDto;
import com.gaming.platform.module.payment.entity.DepositRequest;
import com.gaming.platform.module.payment.entity.WhatsAppMessage;
import com.gaming.platform.module.payment.entity.WhatsAppTicket;
import com.gaming.platform.module.payment.repository.DepositRequestRepository;
import com.gaming.platform.module.payment.repository.WhatsAppMessageRepository;
import com.gaming.platform.module.payment.repository.WhatsAppTicketRepository;
import com.gaming.platform.module.user.entity.User;
import com.gaming.platform.module.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class WhatsAppWebhookService {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppWebhookService.class);

    private static final Pattern REF_PATTERN = Pattern.compile("(DEP-\\d+-\\d+|WDR-\\d+-\\d+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern UTR_PATTERN = Pattern.compile("\\b(\\d{12})\\b");

    private final WhatsAppTicketRepository ticketRepository;
    private final WhatsAppMessageRepository messageRepository;
    private final DepositRequestRepository depositRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @Value("${rmg.whatsapp.official-number:+919876543210}")
    private String officialWhatsAppNumber;

    @Transactional
    public void processInboundWebhook(WhatsAppInboundWebhookDto payload) {
        String senderPhone = null;
        String messageBody = "";
        String mediaUrl = null;
        String mediaType = null;
        String waMessageId = "WA-IN-" + UUID.randomUUID();

        // 1. Extract from standard Meta WhatsApp Cloud API format if present
        if (payload.getEntry() != null && !payload.getEntry().isEmpty()) {
            try {
                var change = payload.getEntry().get(0).getChanges().get(0).getValue();
                if (change.getMessages() != null && !change.getMessages().isEmpty()) {
                    var msg = change.getMessages().get(0);
                    senderPhone = msg.getFrom();
                    waMessageId = msg.getId();
                    if ("text".equalsIgnoreCase(msg.getType()) && msg.getText() != null) {
                        messageBody = msg.getText().getBody();
                    } else if ("image".equalsIgnoreCase(msg.getType())) {
                        mediaType = "IMAGE";
                        mediaUrl = "/uploads/whatsapp/" + msg.getImage().getId() + ".jpg";
                    }
                }
            } catch (Exception e) {
                log.warn("Error parsing Meta Cloud API format, falling back to direct payload: {}", e.getMessage());
            }
        }

        // 2. Direct / Simulator payload fallback
        if (senderPhone == null && payload.getFrom() != null) {
            senderPhone = payload.getFrom();
            messageBody = payload.getBody() != null ? payload.getBody() : "";
            mediaUrl = payload.getMediaUrl();
            mediaType = payload.getMediaType();
        }

        if (senderPhone == null) {
            log.warn("Inbound WhatsApp message ignored: No valid sender phone found");
            return;
        }

        log.info("Processing inbound WhatsApp message from {}: '{}' [media: {}]", senderPhone, messageBody, mediaUrl);

        // Normalize sender phone for matching
        String cleanPhone = senderPhone.replace("+", "").trim();
        Optional<User> matchedUser = userRepository.findByPhoneNumber("+" + cleanPhone)
                .or(() -> userRepository.findByPhoneNumber(cleanPhone));

        // Detect Reference Code and UTR
        String detectedRef = null;
        Matcher refMatcher = REF_PATTERN.matcher(messageBody);
        if (refMatcher.find()) {
            detectedRef = refMatcher.group(1).toUpperCase();
        }

        String detectedUtr = null;
        Matcher utrMatcher = UTR_PATTERN.matcher(messageBody);
        if (utrMatcher.find()) {
            detectedUtr = utrMatcher.group(1);
        }

        // Find or create Ticket
        final String finalRef = detectedRef;
        WhatsAppTicket ticket = null;
        if (detectedRef != null) {
            ticket = ticketRepository.findByRelatedReferenceCode(detectedRef).orElse(null);
        }
        if (ticket == null) {
            String finalSenderPhone = senderPhone;
            ticket = ticketRepository.findFirstBySenderPhoneAndStatusNotOrderByLastMessageAtDesc(
                    senderPhone, WhatsAppTicket.TicketStatus.CLOSED
            ).orElseGet(() -> {
                WhatsAppTicket newTicket = WhatsAppTicket.builder()
                        .ticketNumber("TKT-" + System.currentTimeMillis())
                        .user(matchedUser.orElse(null))
                        .senderPhone(finalSenderPhone)
                        .relatedReferenceCode(finalRef)
                        .ticketType(WhatsAppTicket.TicketType.PAYMENT_VERIFICATION)
                        .status(WhatsAppTicket.TicketStatus.OPEN)
                        .build();
                return ticketRepository.save(newTicket);
            });
        }

        if (detectedRef != null && ticket.getRelatedReferenceCode() == null) {
            ticket.setRelatedReferenceCode(detectedRef);
        }
        ticket.setStatus(WhatsAppTicket.TicketStatus.IN_PROGRESS);

        // Save incoming message
        WhatsAppMessage message = WhatsAppMessage.builder()
                .ticket(ticket)
                .waMessageId(waMessageId)
                .senderType(WhatsAppMessage.SenderType.USER)
                .senderPhone(senderPhone)
                .recipientPhone(officialWhatsAppNumber)
                .messageBody(messageBody)
                .mediaUrl(mediaUrl)
                .mediaType(mediaType)
                .deliveryStatus("RECEIVED")
                .build();

        ticket.addMessage(message);
        messageRepository.save(message);
        ticketRepository.save(ticket);

        // Link with Deposit Request if reference detected
        if (detectedRef != null && detectedRef.startsWith("DEP-")) {
            Optional<DepositRequest> depositOpt = depositRepository.findByReferenceCode(detectedRef);
            if (depositOpt.isPresent()) {
                DepositRequest dep = depositOpt.get();
                if (dep.getStatus() == DepositRequest.DepositStatus.PENDING) {
                    dep.setStatus(DepositRequest.DepositStatus.UNDER_REVIEW);
                }
                if (detectedUtr != null && dep.getUtrNumber() == null) {
                    dep.setUtrNumber(detectedUtr);
                }
                if (mediaUrl != null && dep.getProofImageUrl() == null) {
                    dep.setProofImageUrl(mediaUrl);
                }
                depositRepository.save(dep);

                // Broadcast real-time update to Admin review queue
                messagingTemplate.convertAndSend("/topic/admin/deposits", dep);
            }
        }

        // Broadcast to WhatsApp inbox listener
        messagingTemplate.convertAndSend("/topic/admin/whatsapp", ticket);
    }
}
