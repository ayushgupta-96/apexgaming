package com.gaming.platform.module.compliance.repository;

import com.gaming.platform.module.compliance.entity.FraudFlag;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FraudFlagRepository extends JpaRepository<FraudFlag, Long> {
    List<FraudFlag> findByUserIdOrderByCreatedAtDesc(Long userId);
    List<FraudFlag> findByResolvedFalseOrderByCreatedAtDesc();
}
