package com.gaming.platform.common.filter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gaming.platform.common.response.ApiResponse;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class GeoBlockingFilter extends OncePerRequestFilter {

    private final List<String> restrictedJurisdictions;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public GeoBlockingFilter(
            @Value("${rmg.compliance.restricted-jurisdictions:ASSAM,ODISHA,TELANGANA,ANDHRA_PRADESH,NAGALAND,SIKKIM}")
            List<String> restrictedJurisdictions) {
        this.restrictedJurisdictions = restrictedJurisdictions.stream()
                .map(String::toUpperCase)
                .toList();
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String path = request.getRequestURI();

        // Apply geo-blocking only to real-money game and financial transaction routes
        if (isProtectedRmgRoute(path)) {
            String clientState = extractClientState(request);

            if (clientState != null && restrictedJurisdictions.contains(clientState.toUpperCase())) {
                response.setStatus(HttpStatus.FORBIDDEN.value());
                response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                ApiResponse<Void> errorResponse = ApiResponse.error(
                        "Access Denied: Real-money gaming is legally restricted in jurisdiction: " + clientState);
                response.getWriter().write(objectMapper.writeValueAsString(errorResponse));
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    private boolean isProtectedRmgRoute(String path) {
        return path.startsWith("/api/games") ||
               path.startsWith("/api/wallet") ||
               path.startsWith("/api/deposits") ||
               path.startsWith("/api/withdrawals");
    }

    private String extractClientState(HttpServletRequest request) {
        // Reads simulated CDN / GeoIP headers: X-User-State, CF-IPState, X-Geo-Region
        String state = request.getHeader("X-User-State");
        if (state != null && !state.isBlank()) {
            return state.trim();
        }
        String cfRegion = request.getHeader("CF-IPState");
        if (cfRegion != null && !cfRegion.isBlank()) {
            return cfRegion.trim();
        }
        return request.getHeader("X-Geo-Region");
    }
}
