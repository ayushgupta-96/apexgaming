package com.gaming.platform.module.user.repository;

import com.gaming.platform.module.user.entity.UserLimits;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserLimitsRepository extends JpaRepository<UserLimits, Long> {
    Optional<UserLimits> findByUserId(Long userId);
}
