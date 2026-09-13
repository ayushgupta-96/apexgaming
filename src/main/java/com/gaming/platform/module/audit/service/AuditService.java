package com.gaming.platform.module.audit.service;

import com.gaming.platform.common.security.SecurityUtils;
import com.gaming.platform.common.security.UserPrincipal;
import com.gaming.platform.module.audit.entity.AuditLog;
import com.gaming.platform.module.audit.repository.AuditLogRepository;
import com.gaming.platform.module.user.entity.User;
import com.gaming.platform.module.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuditService {

    private static final Logger log = LoggerFactory.getLogger(AuditService.class);

    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordAction(String action, String targetEntity, String targetId, String reason) {
        UserPrincipal principal = SecurityUtils.getCurrentUserPrincipal();
        Long actorId = principal != null ? principal.getId() : null;
        String username = principal != null ? principal.getUsername() : "SYSTEM";
        String role = principal != null && !principal.getAuthorities().isEmpty()
                ? principal.getAuthorities().iterator().next().getAuthority()
                : "SYSTEM";

        User actor = actorId != null ? userRepository.findById(actorId).orElse(null) : null;

        AuditLog entry = AuditLog.builder()
                .actor(actor)
                .actorUsername(username)
                .actorRole(role)
                .action(action)
                .targetEntity(targetEntity)
                .targetId(targetId)
                .reason(reason)
                .build();

        auditLogRepository.save(entry);
        log.info("AUDIT LOG: [Actor: {} | Role: {}] performed {} on {} ({}) - Reason: {}",
                username, role, action, targetEntity, targetId, reason);
    }
}
