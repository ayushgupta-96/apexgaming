package com.gaming.platform.module.payment.repository;

import com.gaming.platform.module.payment.entity.WhatsAppTicket;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface WhatsAppTicketRepository extends JpaRepository<WhatsAppTicket, Long> {
    Optional<WhatsAppTicket> findByTicketNumber(String ticketNumber);
    Optional<WhatsAppTicket> findFirstBySenderPhoneAndStatusNotOrderByLastMessageAtDesc(String senderPhone, WhatsAppTicket.TicketStatus status);
    Optional<WhatsAppTicket> findByRelatedReferenceCode(String relatedReferenceCode);
    Page<WhatsAppTicket> findByStatusOrderByLastMessageAtDesc(WhatsAppTicket.TicketStatus status, Pageable pageable);
    long countByStatus(WhatsAppTicket.TicketStatus status);
}
