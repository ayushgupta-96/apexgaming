package com.gaming.platform.module.game.aviator.repository;

import com.gaming.platform.module.game.aviator.entity.AviatorRound;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AviatorRoundRepository extends JpaRepository<AviatorRound, Long> {
    Optional<AviatorRound> findByRoundId(Long roundId);
    Optional<AviatorRound> findFirstByStatusOrderByRoundIdDesc(AviatorRound.AviatorStatus status);
}
