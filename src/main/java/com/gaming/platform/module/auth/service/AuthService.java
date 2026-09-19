package com.gaming.platform.module.auth.service;

import com.gaming.platform.common.exception.BusinessException;
import com.gaming.platform.common.security.JwtTokenProvider;
import com.gaming.platform.common.security.UserPrincipal;
import com.gaming.platform.common.util.TotpUtil;
import com.gaming.platform.module.auth.dto.*;
import com.gaming.platform.module.user.entity.*;
import com.gaming.platform.module.user.repository.SelfExclusionRepository;
import com.gaming.platform.module.user.repository.UserLimitsRepository;
import com.gaming.platform.module.user.repository.UserProfileRepository;
import com.gaming.platform.module.user.repository.UserRepository;
import com.gaming.platform.module.wallet.service.LedgerService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.Period;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final UserProfileRepository profileRepository;
    private final UserLimitsRepository limitsRepository;
    private final SelfExclusionRepository selfExclusionRepository;
    private final LedgerService ledgerService;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider tokenProvider;

    @Value("${rmg.compliance.minimum-age:18}")
    private int minimumAge;

    @Value("${security.admin.two-factor.issuer:AntigravityRMG}")
    private String twoFactorIssuer;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        // 1. Compliance: Legal age check
        int age = Period.between(request.getDateOfBirth(), LocalDate.now()).getYears();
        if (age < minimumAge) {
            throw new BusinessException("Registration rejected: You must be at least " + minimumAge + " years old to participate in real-money gaming.");
        }

        // 2. Duplicate checks
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new BusinessException("Username is already taken");
        }
        if (userRepository.existsByPhoneNumber(request.getPhoneNumber())) {
            throw new BusinessException("Phone number is already registered");
        }
        if (request.getEmail() != null && userRepository.existsByEmail(request.getEmail())) {
            throw new BusinessException("Email is already registered");
        }

        // 4. Create User entity
        User user = User.builder()
                .username(request.getUsername())
                .phoneNumber(request.getPhoneNumber())
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(Role.USER)
                .active(true)
                .frozen(false)
                .build();
        User savedUser = userRepository.save(user);

        // 5. Create Profile
        UserProfile profile = UserProfile.builder()
                .user(savedUser)
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .dateOfBirth(request.getDateOfBirth())
                .build();
        profileRepository.save(profile);

        // 6. Create Responsible Gaming Limits
        UserLimits limits = UserLimits.builder()
                .user(savedUser)
                .dailyDepositLimit(BigDecimal.valueOf(25000.00))
                .dailyLossLimit(BigDecimal.valueOf(15000.00))
                .dailyTimeLimitMinutes(360)
                .build();
        limitsRepository.save(limits);

        // 7. Initialize Double-Entry Ledger and Wallet
        ledgerService.initializeUserWallet(savedUser);

        // 8. Generate JWT tokens
        UserPrincipal principal = UserPrincipal.create(savedUser);
        Authentication authentication = new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
        String accessToken = tokenProvider.generateAccessToken(authentication);
        String refreshToken = tokenProvider.generateRefreshToken(savedUser.getId());

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .userId(savedUser.getId())
                .username(savedUser.getUsername())
                .phoneNumber(savedUser.getPhoneNumber())
                .role(savedUser.getRole())
                .requires2fa(false)
                .build();
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getUsernameOrPhone(), request.getPassword())
        );

        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        User user = userRepository.findById(principal.getId())
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.UNAUTHORIZED));

        if (!user.isActive()) {
            throw new BusinessException("Account is deactivated. Please contact support.", HttpStatus.FORBIDDEN);
        }
        if (user.isFrozen()) {
            throw new BusinessException("Account has been frozen due to security or compliance flag.", HttpStatus.FORBIDDEN);
        }

        // Check active self-exclusion
        selfExclusionRepository.findActiveExclusion(user.getId(), Instant.now()).ifPresent(exclusion -> {
            throw new BusinessException("Account is currently self-excluded under responsible gaming until: " + exclusion.getEndTime(), HttpStatus.FORBIDDEN);
        });

        // 2FA Enforcement for Admins
        if (user.isTwoFactorEnabled()) {
            if (request.getTotpCode() == null) {
                return AuthResponse.builder()
                        .requires2fa(true)
                        .userId(user.getId())
                        .username(user.getUsername())
                        .role(user.getRole())
                        .build();
            }
            boolean valid = TotpUtil.validateCode(user.getTwoFactorSecret(), request.getTotpCode());
            if (!valid) {
                throw new BusinessException("Invalid 2FA TOTP code", HttpStatus.UNAUTHORIZED);
            }
        }

        SecurityContextHolder.getContext().setAuthentication(authentication);
        String accessToken = tokenProvider.generateAccessToken(authentication);
        String refreshToken = tokenProvider.generateRefreshToken(user.getId());


        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .userId(user.getId())
                .username(user.getUsername())
                .phoneNumber(user.getPhoneNumber())
                .role(user.getRole())
                .requires2fa(false)
                .build();
    }

    @Transactional(readOnly = true)
    public AuthResponse refresh(RefreshTokenRequest request) {
        if (!tokenProvider.validateToken(request.getRefreshToken())) {
            throw new BusinessException("Invalid or expired refresh token", HttpStatus.UNAUTHORIZED);
        }

        Long userId = tokenProvider.getUserIdFromToken(request.getRefreshToken());
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.UNAUTHORIZED));

        UserPrincipal principal = UserPrincipal.create(user);
        Authentication auth = new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
        String newAccessToken = tokenProvider.generateAccessToken(auth);
        String newRefreshToken = tokenProvider.generateRefreshToken(userId);

        return AuthResponse.builder()
                .accessToken(newAccessToken)
                .refreshToken(newRefreshToken)
                .userId(user.getId())
                .username(user.getUsername())
                .phoneNumber(user.getPhoneNumber())
                .role(user.getRole())
                .build();
    }

    @Transactional
    public Admin2faSetupResponse setupAdmin2fa(Long adminId) {
        User admin = userRepository.findById(adminId)
                .orElseThrow(() -> new BusinessException("Admin user not found"));

        String secret = TotpUtil.generateSecretKey();
        admin.setTwoFactorSecret(secret);
        userRepository.save(admin);

        String otpAuthUri = TotpUtil.getOtpAuthUri(secret, admin.getUsername(), twoFactorIssuer);

        return Admin2faSetupResponse.builder()
                .secret(secret)
                .otpAuthUri(otpAuthUri)
                .instructions("Scan this QR code in Google Authenticator or Authy, then verify with a 6-digit code.")
                .build();
    }

    @Transactional
    public boolean verifyAndEnableAdmin2fa(Long adminId, int code) {
        User admin = userRepository.findById(adminId)
                .orElseThrow(() -> new BusinessException("Admin user not found"));

        if (admin.getTwoFactorSecret() == null) {
            throw new BusinessException("2FA setup not initiated. Call /setup first.");
        }

        boolean valid = TotpUtil.validateCode(admin.getTwoFactorSecret(), code);
        if (!valid) {
            throw new BusinessException("Invalid 2FA code. Verification failed.");
        }

        admin.setTwoFactorEnabled(true);
        userRepository.save(admin);
        return true;
    }
}
