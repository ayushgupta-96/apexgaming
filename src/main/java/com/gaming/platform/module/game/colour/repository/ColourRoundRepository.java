package com.gaming.platform.module.game.colour.repository;

import com.gaming.platform.module.game.colour.entity.ColourRound;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ColourRoundRepository extends JpaRepository<ColourRound, Long> {
    Optional<ColourRound> findByRoundId(Long roundId);
}
