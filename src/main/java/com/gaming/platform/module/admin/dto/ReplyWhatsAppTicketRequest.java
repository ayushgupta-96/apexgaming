package com.gaming.platform.module.admin.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ReplyWhatsAppTicketRequest {

    @NotBlank(message = "Message text is required")
    private String messageBody;

    private String mediaUrl;
}
