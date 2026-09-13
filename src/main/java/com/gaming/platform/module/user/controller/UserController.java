package com.gaming.platform.module.user.controller;

import com.gaming.platform.common.exception.BusinessException;
import com.gaming.platform.common.response.ApiResponse;
import com.gaming.platform.common.security.SecurityUtils;
import com.gaming.platform.module.user.dto.SelfExclusionRequestDto;
import com.gaming.platform.module.user.dto.UserLimitsUpdateDto;
import com.gaming.platform.module.user.dto.UserProfileUpdateDto;
import com.gaming.platform.module.user.entity.SelfExclusion;
import com.gaming.platform.module.user.entity.User;
import com.gaming.platform.module.user.entity.UserLimits;
import com.gaming.platform.module.user.entity.UserProfile;
import com.gaming.platform.module.user.repository.SelfExclusionRepository;
import com.gaming.platform.module.user.repository.UserLimitsRepository;
import com.gaming.platform.module.user.repository.UserProfileRepository;
import com.gaming.platform.module.user.repository.UserRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@Tag(name = "User Profile & Responsible Gaming", description = "User profile, bank details, responsible gaming deposit limits and self-exclusion")
public class UserController {

    private final UserRepository userRepository;
    private final UserProfileRepository profileRepository;
    private final UserLimitsRepository limitsRepository;
    private final SelfExclusionRepository exclusionRepository;

    @GetMapping("/profile")
    @Operation(summary = "Get user profile and banking details")
    public ResponseEntity<ApiResponse<UserProfile>> getProfile() {
        Long userId = SecurityUtils.getCurrentUserId();
        UserProfile profile = profileRepository.findByUserId(userId)
                .orElseThrow(() -> new BusinessException("User profile not found"));
        return ResponseEntity.ok(ApiResponse.ok(profile));
    }

    @PutMapping("/profile")
    @Operation(summary = "Update user bank account and UPI details for manual payouts")
    @Transactional
    public ResponseEntity<ApiResponse<UserProfile>> updateProfile(@Valid @RequestBody UserProfileUpdateDto dto) {
        Long userId = SecurityUtils.getCurrentUserId();
        UserProfile profile = profileRepository.findByUserId(userId)
                .orElseThrow(() -> new BusinessException("User profile not found"));

        profile.setBankAccountNumber(dto.getBankAccountNumber());
        profile.setBankIfscCode(dto.getBankIfscCode());
        profile.setBankName(dto.getBankName());
        profile.setUpiId(dto.getUpiId());
        if (dto.getFirstName() != null) profile.setFirstName(dto.getFirstName());
        if (dto.getLastName() != null) profile.setLastName(dto.getLastName());

        UserProfile updated = profileRepository.save(profile);
        return ResponseEntity.ok(ApiResponse.ok("Profile and bank details updated", updated));
    }

    @GetMapping("/limits")
    @Operation(summary = "Get user responsible gaming deposit, loss, and time limits")
    public ResponseEntity<ApiResponse<UserLimits>> getLimits() {
        Long userId = SecurityUtils.getCurrentUserId();
        UserLimits limits = limitsRepository.findByUserId(userId)
                .orElseThrow(() -> new BusinessException("Limits not configured"));
        return ResponseEntity.ok(ApiResponse.ok(limits));
    }

    @PutMapping("/limits")
    @Operation(summary = "Update responsible gaming limits (deposit and loss limits)")
    @Transactional
    public ResponseEntity<ApiResponse<UserLimits>> updateLimits(@Valid @RequestBody UserLimitsUpdateDto dto) {
        Long userId = SecurityUtils.getCurrentUserId();
        UserLimits limits = limitsRepository.findByUserId(userId)
                .orElseThrow(() -> new BusinessException("Limits not configured"));

        limits.setDailyDepositLimit(dto.getDailyDepositLimit());
        limits.setDailyLossLimit(dto.getDailyLossLimit());
        if (dto.getDailyTimeLimitMinutes() != null) {
            limits.setDailyTimeLimitMinutes(dto.getDailyTimeLimitMinutes());
        }

        UserLimits updated = limitsRepository.save(limits);
        return ResponseEntity.ok(ApiResponse.ok("Responsible gaming limits updated successfully", updated));
    }

    @PostMapping("/self-exclude")
    @Operation(summary = "Request self-exclusion (cool-off, temporary, or permanent account lock)")
    @Transactional
    public ResponseEntity<ApiResponse<SelfExclusion>> selfExclude(@Valid @RequestBody SelfExclusionRequestDto dto) {
        Long userId = SecurityUtils.getCurrentUserId();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("User not found"));

        Instant now = Instant.now();
        Instant endTime = null;

        if (dto.getExclusionType() == SelfExclusion.ExclusionType.COOL_OFF) {
            int hours = dto.getDurationHours() != null ? dto.getDurationHours() : 24;
            endTime = now.plus(hours, ChronoUnit.HOURS);
        } else if (dto.getExclusionType() == SelfExclusion.ExclusionType.TEMPORARY) {
            int days = dto.getDurationHours() != null ? dto.getDurationHours() / 24 : 30;
            endTime = now.plus(days, ChronoUnit.DAYS);
        }
        // PERMANENT has null endTime

        SelfExclusion exclusion = SelfExclusion.builder()
                .user(user)
                .exclusionType(dto.getExclusionType())
                .startTime(now)
                .endTime(endTime)
                .reason(dto.getReason())
                .active(true)
                .build();

        SelfExclusion saved = exclusionRepository.save(exclusion);
        return ResponseEntity.ok(ApiResponse.ok("Self-exclusion activated. For safety, account access is restricted.", saved));
    }

    @GetMapping("/self-exclude")
    @Operation(summary = "Get active and past self-exclusions")
    public ResponseEntity<ApiResponse<List<SelfExclusion>>> getExclusions() {
        Long userId = SecurityUtils.getCurrentUserId();
        List<SelfExclusion> history = exclusionRepository.findByUserIdOrderByCreatedAtDesc(userId);
        return ResponseEntity.ok(ApiResponse.ok(history));
    }
}
