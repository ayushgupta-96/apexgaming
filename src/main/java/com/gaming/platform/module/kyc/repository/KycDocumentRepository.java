package com.gaming.platform.module.kyc.repository;

import com.gaming.platform.module.kyc.entity.KycDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface KycDocumentRepository extends JpaRepository<KycDocument, Long> {
    List<KycDocument> findByUserIdOrderByCreatedAtDesc(Long userId);
    Optional<KycDocument> findTopByUserIdAndStatusOrderByCreatedAtDesc(Long userId, KycDocument.KycStatus status);
    List<KycDocument> findByStatusOrderByCreatedAtAsc(KycDocument.KycStatus status);
    boolean existsByUserIdAndStatus(Long userId, KycDocument.KycStatus status);
}
