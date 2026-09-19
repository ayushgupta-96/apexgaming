# Apex Gaming: Enterprise Real-Money Gaming (RMG) Platform

> **COMPLIANCE NOTICE**:
> The platform enforces mandatory 18+ age verification, Anti-Money Laundering (AML) monitoring, and responsible gaming limits. Registration does not collect or use a state/jurisdiction field.

---

## 1. Technical Architecture & Tech Stack

- **Core Framework**: Java 21, Spring Boot 3.3.3
- **Security**: Spring Security 6 (Stateless JWT + Refresh token rotation, BCrypt, RFC 6238 TOTP 2FA)
- **Data Persistence**: Spring Data JPA, Hibernate 6, PostgreSQL 16 (Serializable / Pessimistic Write locking)
- **Database Migrations**: Flyway (V1 through V7)
- **Cache & Real-time State**: Redis 7 (Token blacklist, rate-limiting, live game locks)
- **Real-time Messaging**: Spring WebSocket with STOMP message broker (`/topic`, `/queue`)
- **Asynchronous Events**: Spring AMQP & RabbitMQ 3.13
- **Rate Limiting**: Bucket4j Token Bucket Algorithm
- **API Documentation**: OpenAPI 3.0 / Swagger UI (Springdoc 2.6.0)
- **Observability**: Spring Boot Actuator, Micrometer Prometheus, Grafana
- **Containerization & Orchestration**: Docker multi-stage build, Docker Compose, Kubernetes manifests (Deployment, HPA, Ingress)

---

## 2. Double-Entry Financial Ledger & Wallet Engine

The platform eliminates raw balance manipulation (`UPDATE wallet SET balance = balance + x` is physically prohibited). All balance mutations must flow through the `LedgerService`.

### Balance Buckets per User:
1. `deposit_balance`: Real funds deposited by the user.
2. `winnings_balance`: Funds won by playing games. **Only this balance is legally withdrawable**.
3. `bonus_balance`: Promotional / signup credits subject to wagering playthrough.
4. `locked_balance`: Funds temporarily encumbered (e.g. pending manual withdrawal verification or active game stakes).

### System Chart of Accounts:
- `USER_{userId}` (Customer Liability Account)
- `HOUSE_BANK_CLEARING` (Real platform physical bank account asset float)
- `HOUSE_COMMISSION_REVENUE` (Platform gaming rake & house margin revenue)
- `GAME_ESCROW_POOL` (Held player stakes during active rounds)

### Double-Entry Accounting Rule Matrix:
| Transaction Type | Debit Account | Credit Account | Balance Effect |
| :--- | :--- | :--- | :--- |
| **Deposit Approval** | `HOUSE_BANK_CLEARING` | `USER_{userId}` (Deposit) | User deposit balance increases |
| **Withdrawal Request** | `USER_{userId}` (Winnings) | `USER_{userId}` (Locked) | Winnings moved to locked balance |
| **Withdrawal Payout** | `USER_{userId}` (Locked) | `HOUSE_BANK_CLEARING` | Locked funds settled out of bank |
| **Withdrawal Reject** | `USER_{userId}` (Locked) | `USER_{userId}` (Winnings) | Locked funds refunded to winnings |
| **Bet Placed** | `USER_{userId}` (Playable) | `GAME_ESCROW_POOL` | Stake placed into round escrow |
| **Game Win Payout** | `GAME_ESCROW_POOL` | `USER_{userId}` (Winnings) | Winnings credited from round escrow |
| **House Commission** | `GAME_ESCROW_POOL` | `HOUSE_COMMISSION_REVENUE`| Rake moved to platform revenue |

---

## 3. Manual Payment Verification via WhatsApp

The platform does not rely on third-party automated payment gateways. All deposits and payouts are verified manually by administrators through official WhatsApp channels.

### Deposit Workflow:
1. **User Request**: User specifies deposit amount (minimum ₹100).
2. **Reference Code**: System generates unique code `DEP-{userId}-{timestamp}`.
3. **Payment Details**: System displays platform UPI VPA (`rmgfinance@icici`), bank account number, IFSC, and a dynamic WhatsApp Click-to-Chat deep-link:
   ```
   https://wa.me/919876543210?text=Hello+Admin%2C+I+have+initiated+a+deposit+of+%E2%82%B9500+on+RMG+Platform.+Reference+Code%3A+DEP-101-1725984000
   ```
4. **Proof Submission**: User pays via UPI/IMPS and sends the transaction screenshot and 12-digit UTR to the WhatsApp number.
5. **Webhook Ingestion**: WhatsApp webhook (`POST /api/webhooks/whatsapp`) ingests the payload, regex parses the `DEP-...` code and UTR, updates deposit status to `UNDER_REVIEW`, and creates an Admin Ticket.
6. **Admin Verification**: Finance admin inspects physical bank statement in Admin Console.
7. **Approval**: Admin clicks "Approve" (verified with Admin TOTP 2FA). The ledger credits the user deposit balance, and an outbound WhatsApp notification is automatically dispatched to the user.

### Withdrawal Workflow:
1. **Compliance Check**: System verifies user account is non-frozen, and AML 100% wagering turnover is satisfied.
2. **Atomic Lock**: Funds are locked from `winnings_balance` to `locked_balance`.
3. **Queue Ticket**: Ticket created in Admin Withdrawal Queue with player bank/UPI details.
4. **Manual Transfer**: Admin executes manual IMPS/UPI bank payout.
5. **Payout Settlement**: Admin inputs bank UTR, uploads payment receipt, and clicks "Mark Paid". Ledger debits locked funds, credits clearing, and dispatches WhatsApp receipt to user.

---

## 4. Provably Fair Games

### A. Aviator (Crash Game)
- **Multiplier Curve**: Continuous exponential curve $y(t) = 1.00 \cdot e^{0.06 \cdot t}$.
- **Provably Fair Algorithm**:
  - Pre-round: Server generates 256-bit cryptographically secure `server_seed`, computes `server_seed_hash = SHA256(server_seed)`, and broadcasts it to players before betting begins.
  - Crash multiplier derived from HMAC-SHA256(`server_seed`, `client_seed` + `:` + `nonce`) with a configurable 3% house edge.
  - Post-round: `server_seed` is publicly revealed. Players can independently verify the exact crash multiplier at `/api/games/aviator/verify`.
- **Auto-Cashout**: Server-side auto-cashout triggered at configured multiplier (e.g. 2.50x).
- **WebSocket Feed**: Real-time STOMP topic `/topic/games/aviator` updates multiplier every 100ms.

### B. Colour Prediction
- **Round Cycle**: Continuous 60-second rounds (0–50s: Open for bets; 50–60s: Locked for result calculation).
- **Payout Table**:
  - Green (1, 3, 7, 9) $\to 2.0\times$
  - Red (2, 4, 6, 8) $\to 2.0\times$
  - Violet (0, 5) $\to 4.5\times$
  - Number 0 (Red + Violet) $\to$ Red pays $1.5\times$, Violet pays $4.5\times$
  - Number 5 (Green + Violet) $\to$ Green pays $1.5\times$, Violet pays $4.5\times$
  - Exact Number (0–9) $\to 9.0\times$
- **Fairness**: SHA-256 HMAC commitment committed before betting opens. Independent verification at `/api/games/colour/verify`.

### C. Real-Money Ludo
- **Matchmaking**: 2 to 4 player rooms with stake levels (₹50, ₹100, ₹250, ₹500).
- **Escrow**: Stakes pooled into `GAME_ESCROW_POOL` upon room creation and join.
- **Server-Authoritative Rules**:
  - Dice roll generated server-side using `java.security.SecureRandom`.
  - Pawn spawn required on roll of 6.
  - Track traversal (52 cells) + 6 home stretch cells + home cell (999).
  - Safe zones (Stars): cells 0, 8, 13, 21, 26, 34, 39, 47.
  - Opponent pawn capture knocks opponent token back to base (-1) and awards an extra roll.
  - 15-second turn timer with automated pass.
- **Payout**: Winner receives `Total Pot * (1 - 0.08)`, and 8% house rake is credited to `HOUSE_COMMISSION_REVENUE`.

---

## 5. RMG Compliance & Security Guardrails

1. **Age Gate**: Mandatory 18+ declaration on signup and document birthdate validation.
2. **AML Surveillance**:
   - Single transactions $\ge ₹50,000$ trigger AML alerts.
   - Cumulative daily deposit thresholds ($\ge ₹100,000$) trigger velocity flags.
   - Anti-money laundering 100% wagering turnover check: users cannot withdraw funds without wagering at least 100% of their deposits.
3. **Responsible Gaming**: Daily deposit limits, daily loss limits, session timers, and 24-hour / 30-day self-exclusion cool-off locks.
4. **Admin 2FA**: Google Authenticator / RFC 6238 TOTP required for all admin payouts and sensitive actions.

---

## 6. API Reference (Selected Endpoints)

| Method | Path | Description | Roles |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register new user (18+ check) | Public |
| `POST` | `/api/auth/login` | Authenticate with JWT (+ Admin 2FA) | Public |
| `GET`  | `/api/wallet` | Get deposit, winnings, bonus, locked balances | User |
| `POST` | `/api/deposits` | Create manual deposit request & WhatsApp link | User |
| `POST` | `/api/withdrawals` | Request withdrawal of verified winnings | User |
| `POST` | `/api/webhooks/whatsapp` | Meta WhatsApp Cloud API proof receiver | Public |
| `GET`  | `/api/games/aviator/state` | Current flight multiplier & history | Public / User |
| `POST` | `/api/games/aviator/bet` | Place Aviator crash bet | User |
| `POST` | `/api/games/aviator/cashout` | Manual cashout during flight | User |
| `GET`  | `/api/games/colour/state` | 60-second round countdown and status | Public / User |
| `POST` | `/api/games/colour/bet` | Place bet on colour or number | User |
| `POST` | `/api/games/ludo/rooms` | Create real-money Ludo room with stake | User |
| `POST` | `/api/games/ludo/rooms/move`| Server-authoritative pawn move | User |
| `GET`  | `/api/admin/dashboard` | KPI analytics, revenues, escrow liabilities | Admin, Finance |
| `POST` | `/api/admin/deposits/approve` | Approve deposit & ledger credit | Admin, Finance |
| `POST` | `/api/admin/withdrawals/approve` | Mark withdrawal paid with UTR | Admin, Finance |
| `GET`  | `/api/admin/whatsapp/tickets` | WhatsApp customer support inbox | Admin, Support |
| `GET`  | `/api/admin/audit-logs` | Immutable audit logs of all actions | Admin |

**Interactive API Documentation**: Access Swagger UI at `http://localhost:8080/swagger-ui.html`.

---

## 7. Quick Start (Docker Compose)

### Prerequisites:
- Docker & Docker Compose
- Java 21 & Maven 3.9+ (for native compilation)

### Start Full Stack:
```bash
# Clone or navigate to directory
cd rmg-platform

# Launch PostgreSQL 16, Redis 7, RabbitMQ, RMG App & Prometheus
docker compose up --build -d

# Inspect running containers
docker compose ps
```

### Access Portals:
- **Player Portal**: `http://localhost:8080/index.html`
- **Admin Management Portal**: `http://localhost:8080/admin.html`
- **Swagger OpenAPI Documentation**: `http://localhost:8080/swagger-ui.html`
- **Prometheus Metrics**: `http://localhost:9090`
- **RabbitMQ Management Dashboard**: `http://localhost:15672` (guest / guest)

### Default Credentials:
- **Demo Player**: Username: `demoplayer` | Password: `Password@123`
- **Admin**: Username: `admin` | Password: `Password@123` (Pre-configured TOTP Secret: `JBSWY3DPEHPK3PXP`)
- **Super Admin**: Username: `superadmin` | Password: `Password@123`
- **Finance Admin**: Username: `finance` | Password: `Password@123`

---

## 8. Kubernetes Production Deployment

```bash
# 1. Apply Namespace & Secrets
kubectl create secret generic rmg-secrets \
  --from-literal=DB_USERNAME=rmg_prod_user \
  --from-literal=DB_PASSWORD="<STRONG_PASSWORD>" \
  --from-literal=JWT_SECRET="<256_BIT_SECRET_KEY>"

# 2. Apply ConfigMap, Deployment, Service, HPA, and Ingress
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/hpa.yaml
kubectl apply -f k8s/ingress.yaml

# 3. Verify Pods & HPA
kubectl get pods -l app=rmg-platform
kubectl get hpa rmg-platform-hpa
```
