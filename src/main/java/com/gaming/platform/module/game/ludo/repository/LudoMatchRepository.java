package com.gaming.platform.module.game.ludo.repository;

import com.gaming.platform.module.game.ludo.entity.LudoMatch;
import com.gaming.platform.module.game.ludo.entity.LudoPlayer;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Repository
public interface LudoMatchRepository extends JpaRepository<LudoMatch, Long> {
    Optional<LudoMatch> findByMatchUuid(String matchUuid);
    List<LudoMatch> findByStatusAndStakeAmount(LudoMatch.MatchStatus status, BigDecimal stakeAmount);
    Page<LudoMatch> findByStatusOrderByCreatedAtDesc(LudoMatch.MatchStatus status, Pageable pageable);
    Page<LudoMatch> findDistinctByPlayersUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select m from LudoMatch m where m.matchUuid = :matchUuid")
    Optional<LudoMatch> findByMatchUuidForUpdate(@Param("matchUuid") String matchUuid);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select m from LudoMatch m where m.matchmaking = true and m.status = com.gaming.platform.module.game.ludo.entity.LudoMatch.MatchStatus.WAITING and m.stakeAmount = :stake and m.maxPlayers = :maxPlayers and m.currentPlayers < m.maxPlayers and not exists (select p.id from LudoPlayer p where p.match = m and p.user.id = :userId) order by m.createdAt asc")
    List<LudoMatch> findAvailableMatchmakingRoomsForUpdate(@Param("stake") BigDecimal stake, @Param("maxPlayers") Integer maxPlayers, @Param("userId") Long userId, Pageable pageable);

    @Query("select m from LudoMatch m where m.matchmaking = true and m.status = com.gaming.platform.module.game.ludo.entity.LudoMatch.MatchStatus.WAITING and m.stakeAmount = :stake and m.maxPlayers = :maxPlayers and exists (select p.id from LudoPlayer p where p.match = m and p.user.id = :userId)")
    Optional<LudoMatch> findOwnWaitingMatchmakingRoom(@Param("stake") BigDecimal stake, @Param("maxPlayers") Integer maxPlayers, @Param("userId") Long userId);

}

