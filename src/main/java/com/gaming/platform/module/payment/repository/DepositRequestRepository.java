package com.gaming.platform.module.payment.repository;

import com.gaming.platform.module.payment.entity.DepositRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DepositRequestRepository extends JpaRepository<DepositRequest, Long> {
    Optional<DepositRequest> findByReferenceCode(String referenceCode);
    List<DepositRequest> findByUserIdOrderByCreatedAtDesc(Long userId);
    Page<DepositRequest> findByStatusOrderByCreatedAtAsc(DepositRequest.DepositStatus status, Pageable pageable);
    long countByStatus(DepositRequest.DepositStatus status);
}
