package com.gaming.platform.module.game.colour.repository;

import com.gaming.platform.module.game.colour.entity.ColourBet;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ColourBetRepository extends JpaRepository<ColourBet, Long> {
    Optional<ColourBet> findByBetId(Long betId);

    @Query("SELECT cb FROM ColourBet cb WHERE cb.bet.round.id = :roundId")
    List<ColourBet> findByRoundId(@Param("roundId") Long roundId);
}
