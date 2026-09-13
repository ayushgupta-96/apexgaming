package com.gaming.platform.module.payment.controller;

import com.gaming.platform.common.response.ApiResponse;
import com.gaming.platform.module.payment.dto.WhatsAppInboundWebhookDto;
import com.gaming.platform.module.payment.service.WhatsAppWebhookService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/webhooks/whatsapp")
@RequiredArgsConstructor
@Tag(name = "WhatsApp Webhook", description = "Webhook for Meta WhatsApp Cloud API / Twilio to receive payment screenshots and customer messages")
public class WhatsAppWebhookController {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppWebhookController.class);

    private final WhatsAppWebhookService webhookService;

    @Value("${rmg.whatsapp.webhook-verify-token:rmg_secure_webhook_verify_token_2026}")
    private String configuredVerifyToken;

    /**
     * Meta WhatsApp Cloud API Webhook Challenge Verification.
     */
    @GetMapping
    @Operation(summary = "Meta Webhook Verification Challenge endpoint")
    public ResponseEntity<String> verifyWebhook(
            @RequestParam(name = "hub.mode", required = false) String mode,
            @RequestParam(name = "hub.verify_token", required = false) String token,
            @RequestParam(name = "hub.challenge", required = false) String challenge) {

        log.info("Received WhatsApp webhook verification request: mode={}, token={}", mode, token);

        if ("subscribe".equals(mode) && configuredVerifyToken.equals(token)) {
            log.info("WhatsApp webhook challenge verified successfully!");
            return ResponseEntity.ok(challenge);
        }

        log.warn("WhatsApp webhook verification token mismatch");
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Forbidden: Invalid verification token");
    }

    /**
     * Inbound WhatsApp message receiver (supports Meta Cloud API and Simulator payloads).
     */
    @PostMapping
    @Operation(summary = "Inbound WhatsApp message/payment proof receiver")
    public ResponseEntity<ApiResponse<String>> handleInboundMessage(@RequestBody WhatsAppInboundWebhookDto payload) {
        webhookService.processInboundWebhook(payload);
        return ResponseEntity.ok(ApiResponse.ok("Webhook processed successfully", "ACK"));
    }
}
