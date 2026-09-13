package com.gaming.platform.module.game.common.repository;

import com.gaming.platform.module.game.common.entity.GameRound;
import com.gaming.platform.module.game.common.entity.GameType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GameRoundRepository extends JpaRepository<GameRound, Long> {
    Optional<GameRound> findByRoundUuid(String roundUuid);
    Optional<GameRound> findFirstByGameTypeAndStatusOrderByCreatedAtDesc(GameType gameType, GameRound.RoundStatus status);
    List<GameRound> findTop20ByGameTypeAndStatusOrderByEndedAtDesc(GameType gameType, GameRound.RoundStatus status);
    Page<GameRound> findByGameTypeOrderByCreatedAtDesc(GameType gameType, Pageable pageable);
}
