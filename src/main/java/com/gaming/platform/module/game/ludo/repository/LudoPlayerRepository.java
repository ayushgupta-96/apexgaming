package com.gaming.platform.module.game.ludo.repository;

import com.gaming.platform.module.game.ludo.entity.LudoPlayer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LudoPlayerRepository extends JpaRepository<LudoPlayer, Long> {
    List<LudoPlayer> findByMatchId(Long matchId);
    Optional<LudoPlayer> findByMatchIdAndUserId(Long matchId, Long userId);
    Optional<LudoPlayer> findByMatchIdAndColor(Long matchId, String color);
}
