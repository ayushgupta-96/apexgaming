package com.gaming.platform.module.game.common.repository;

import com.gaming.platform.module.game.common.entity.Bet;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BetRepository extends JpaRepository<Bet, Long> {
    Optional<Bet> findByBetUuid(String betUuid);
    List<Bet> findByRoundId(Long roundId);
    List<Bet> findByRoundIdAndUserId(Long roundId, Long userId);
    List<Bet> findByRoundIdAndStatus(Long roundId, Bet.BetStatus status);
    Page<Bet> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);
}
