package com.gaming.platform.module.payment.repository;

import com.gaming.platform.module.payment.entity.WhatsAppMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WhatsAppMessageRepository extends JpaRepository<WhatsAppMessage, Long> {
    List<WhatsAppMessage> findByTicketIdOrderByCreatedAtAsc(Long ticketId);
}
