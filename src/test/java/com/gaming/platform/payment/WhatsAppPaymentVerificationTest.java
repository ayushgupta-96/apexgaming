package com.gaming.platform.payment;

import com.gaming.platform.module.compliance.service.AmlService;
import com.gaming.platform.module.payment.dto.DepositCreateRequest;
import com.gaming.platform.module.payment.dto.DepositCreateResponse;
import com.gaming.platform.module.payment.dto.WhatsAppInboundWebhookDto;
import com.gaming.platform.module.payment.entity.DepositRequest;
import com.gaming.platform.module.payment.entity.WhatsAppTicket;
import com.gaming.platform.module.payment.repository.DepositRequestRepository;
import com.gaming.platform.module.payment.repository.WhatsAppMessageRepository;
import com.gaming.platform.module.payment.repository.WhatsAppTicketRepository;
import com.gaming.platform.module.payment.service.PaymentService;
import com.gaming.platform.module.payment.service.WhatsAppWebhookService;
import com.gaming.platform.module.user.entity.Role;
import com.gaming.platform.module.user.entity.User;
import com.gaming.platform.module.user.repository.UserRepository;
import com.gaming.platform.module.wallet.service.LedgerService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WhatsAppPaymentVerificationTest {

    @Mock
    private DepositRequestRepository depositRepository;
    @Mock
    private WhatsAppTicketRepository ticketRepository;
    @Mock
    private WhatsAppMessageRepository messageRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private LedgerService ledgerService;
    @Mock
    private AmlService amlService;
    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @InjectMocks
    private PaymentService paymentService;

    @InjectMocks
    private WhatsAppWebhookService webhookService;

    private User testUser;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(paymentService, "officialWhatsAppNumber", "+919876543210");
        ReflectionTestUtils.setField(paymentService, "officialUpiId", "rmgfinance@icici");
        ReflectionTestUtils.setField(paymentService, "officialBankName", "HDFC Bank");
        ReflectionTestUtils.setField(paymentService, "officialAccountNo", "50200012345678");
        ReflectionTestUtils.setField(paymentService, "officialIfsc", "HDFC0001234");

        ReflectionTestUtils.setField(webhookService, "officialWhatsAppNumber", "+919876543210");

        testUser = User.builder()
                .id(101L)
                .username("testplayer")
                .phoneNumber("+919876500001")
                .role(Role.USER)
                .active(true)
                .verified(true)
                .build();
    }

    @Test
    @DisplayName("Create Deposit: Generates valid DEP reference code and WhatsApp pre-filled link")
    void testCreateDepositRequest() {
        DepositCreateRequest req = new DepositCreateRequest();
        req.setAmount(BigDecimal.valueOf(500.00));
        req.setPaymentMethod("UPI");

        when(userRepository.findById(101L)).thenReturn(Optional.of(testUser));
        when(depositRepository.save(any(DepositRequest.class))).thenAnswer(i -> {
            DepositRequest d = i.getArgument(0);
            d.setId(1L);
            return d;
        });

        DepositCreateResponse res = paymentService.createDepositRequest(101L, req);

        assertNotNull(res);
        assertTrue(res.getReferenceCode().startsWith("DEP-101-"));
        assertTrue(res.getWhatsAppLink().contains("DEP-101-"));
        assertTrue(res.getQrCodeString().contains("upi://pay"));
        assertEquals("rmgfinance@icici", res.getOfficialUpiId());

        verify(ticketRepository).save(any(WhatsAppTicket.class));
    }

    @Test
    @DisplayName("WhatsApp Webhook: Parses incoming message, extracts reference and UTR, updates deposit status")
    void testInboundWebhook_MatchesDeposit() {
        String refCode = "DEP-101-1725984000";
        String utr = "123456789012";

        WhatsAppInboundWebhookDto payload = new WhatsAppInboundWebhookDto();
        payload.setFrom("+919876500001");
        payload.setBody("Hello Admin, I paid for " + refCode + " my bank UTR is " + utr);
        payload.setMediaUrl("/uploads/proofs/scr_1.jpg");
        payload.setMediaType("IMAGE");

        DepositRequest dep = DepositRequest.builder()
                .id(1L)
                .referenceCode(refCode)
                .user(testUser)
                .amount(BigDecimal.valueOf(500.00))
                .status(DepositRequest.DepositStatus.PENDING)
                .build();

        when(userRepository.findByPhoneNumber("+919876500001")).thenReturn(Optional.of(testUser));
        when(depositRepository.findByReferenceCode(refCode)).thenReturn(Optional.of(dep));
        when(ticketRepository.findByRelatedReferenceCode(refCode)).thenReturn(Optional.empty());
        when(ticketRepository.findFirstBySenderPhoneAndStatusNotOrderByLastMessageAtDesc(any(), any()))
                .thenReturn(Optional.empty());
        when(ticketRepository.save(any(WhatsAppTicket.class))).thenAnswer(i -> {
            WhatsAppTicket t = i.getArgument(0);
            t.setId(10L);
            return t;
        });

        webhookService.processInboundWebhook(payload);

        assertEquals(DepositRequest.DepositStatus.UNDER_REVIEW, dep.getStatus());
        assertEquals(utr, dep.getUtrNumber());
        assertEquals("/uploads/proofs/scr_1.jpg", dep.getProofImageUrl());
        verify(depositRepository).save(dep);
    }
}
