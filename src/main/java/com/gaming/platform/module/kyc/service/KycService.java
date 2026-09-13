package com.gaming.platform.module.kyc.service;

import com.gaming.platform.common.exception.BusinessException;
import com.gaming.platform.module.kyc.dto.KycSubmissionRequest;
import com.gaming.platform.module.kyc.entity.KycDocument;
import com.gaming.platform.module.kyc.repository.KycDocumentRepository;
import com.gaming.platform.module.user.entity.User;
import com.gaming.platform.module.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class KycService {

    private final KycDocumentRepository kycRepository;
    private final UserRepository userRepository;

    @Transactional
    public KycDocument submitKyc(Long userId, KycSubmissionRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("User not found"));

        if (kycRepository.existsByUserIdAndStatus(userId, KycDocument.KycStatus.APPROVED)) {
            throw new BusinessException("User KYC is already verified and approved");
        }

        KycDocument document = KycDocument.builder()
                .user(user)
                .documentType(request.getDocumentType())
                .documentNumber(request.getDocumentNumber())
                .documentFrontUrl(request.getDocumentFrontUrl())
                .documentBackUrl(request.getDocumentBackUrl())
                .selfieUrl(request.getSelfieUrl())
                .status(KycDocument.KycStatus.PENDING)
                .build();

        return kycRepository.save(document);
    }

    @Transactional(readOnly = true)
    public List<KycDocument> getUserKycHistory(Long userId) {
        return kycRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    @Transactional(readOnly = true)
    public boolean isKycApproved(Long userId) {
        return kycRepository.existsByUserIdAndStatus(userId, KycDocument.KycStatus.APPROVED);
    }

    @Transactional
    public KycDocument reviewKyc(Long kycId, Long adminId, boolean approve, String rejectionReason) {
        KycDocument doc = kycRepository.findById(kycId)
                .orElseThrow(() -> new BusinessException("KYC document not found with ID: " + kycId));

        User admin = userRepository.findById(adminId)
                .orElseThrow(() -> new BusinessException("Admin user not found"));

        doc.setVerifiedBy(admin);
        doc.setVerifiedAt(Instant.now());

        if (approve) {
            doc.setStatus(KycDocument.KycStatus.APPROVED);
            doc.getUser().setVerified(true);
            userRepository.save(doc.getUser());
        } else {
            doc.setStatus(KycDocument.KycStatus.REJECTED);
            doc.setRejectionReason(rejectionReason);
        }

        return kycRepository.save(doc);
    }
}
