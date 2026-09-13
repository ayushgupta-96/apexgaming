package com.gaming.platform.module.user.repository;

import com.gaming.platform.module.user.entity.SelfExclusion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface SelfExclusionRepository extends JpaRepository<SelfExclusion, Long> {

    @Query("SELECT s FROM SelfExclusion s WHERE s.user.id = :userId AND s.active = true AND (s.endTime IS NULL OR s.endTime > :now)")
    Optional<SelfExclusion> findActiveExclusion(@Param("userId") Long userId, @Param("now") Instant now);

    List<SelfExclusion> findByUserIdOrderByCreatedAtDesc(Long userId);
}
