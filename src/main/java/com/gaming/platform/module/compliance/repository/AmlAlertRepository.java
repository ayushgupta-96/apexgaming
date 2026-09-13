package com.gaming.platform.module.compliance.repository;

import com.gaming.platform.module.compliance.entity.AmlAlert;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AmlAlertRepository extends JpaRepository<AmlAlert, Long> {
    List<AmlAlert> findByUserIdOrderByCreatedAtDesc(Long userId);
    List<AmlAlert> findByStatusOrderByCreatedAtDesc(AmlAlert.AlertStatus status);
}
