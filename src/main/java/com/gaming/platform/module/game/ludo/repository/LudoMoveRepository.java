package com.gaming.platform.module.game.ludo.repository;

import com.gaming.platform.module.game.ludo.entity.LudoMove;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LudoMoveRepository extends JpaRepository<LudoMove, Long> {
    List<LudoMove> findByMatchIdOrderByMoveTimestampAsc(Long matchId);
}
