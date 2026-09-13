package com.gaming.platform.module.payment.repository;

import com.gaming.platform.module.payment.entity.WithdrawalRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WithdrawalRequestRepository extends JpaRepository<WithdrawalRequest, Long> {
    Optional<WithdrawalRequest> findByReferenceCode(String referenceCode);
    List<WithdrawalRequest> findByUserIdOrderByCreatedAtDesc(Long userId);
    Page<WithdrawalRequest> findByStatusOrderByCreatedAtAsc(WithdrawalRequest.WithdrawalStatus status, Pageable pageable);
    long countByStatus(WithdrawalRequest.WithdrawalStatus status);
}
