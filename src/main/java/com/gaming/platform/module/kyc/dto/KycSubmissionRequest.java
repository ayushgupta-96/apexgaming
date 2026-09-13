package com.gaming.platform.module.kyc.dto;

import com.gaming.platform.module.kyc.entity.KycDocument;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class KycSubmissionRequest {

    @NotNull(message = "Document type is required")
    private KycDocument.DocumentType documentType;

    @NotBlank(message = "Document number is required")
    private String documentNumber;

    @NotBlank(message = "Document front photo URL is required")
    private String documentFrontUrl;

    private String documentBackUrl;

    @NotBlank(message = "Selfie photograph URL is required for liveliness validation")
    private String selfieUrl;
}
