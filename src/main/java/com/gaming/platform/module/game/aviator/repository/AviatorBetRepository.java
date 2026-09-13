package com.gaming.platform.module.game.aviator.repository;

import com.gaming.platform.module.game.aviator.entity.AviatorBet;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AviatorBetRepository extends JpaRepository<AviatorBet, Long> {
    Optional<AviatorBet> findByBetId(Long betId);

    @Query("SELECT ab FROM AviatorBet ab WHERE ab.bet.round.id = :roundId AND ab.cashedOut = false")
    List<AviatorBet> findActiveBetsInRound(@Param("roundId") Long roundId);
}
