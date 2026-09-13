package com.gaming.platform.module.game.ludo.repository;

import com.gaming.platform.module.game.ludo.entity.LudoMatch;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Repository
public interface LudoMatchRepository extends JpaRepository<LudoMatch, Long> {
    Optional<LudoMatch> findByMatchUuid(String matchUuid);
    List<LudoMatch> findByStatusAndStakeAmount(LudoMatch.MatchStatus status, BigDecimal stakeAmount);
    Page<LudoMatch> findByStatusOrderByCreatedAtDesc(LudoMatch.MatchStatus status, Pageable pageable);
}
