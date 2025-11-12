## App Availability, Reliability, Responsiveness Settings

### UI-App - Next.js Implementation

The primary goal for the UI-App is to provide a responsive and user-friendly experience, even when downstream services are slow or unavailable.

**Necessary Settings:**

*   **API Call Timeouts:** Implement a timeout for all API calls to the App-API-Proxy. This prevents the UI from hanging indefinitely and provides a better user experience. You can achieve this using `AbortController` with `fetch` or by configuring the timeout in your preferred data-feteching library.
*   **Graceful Error Handling:** Catch and handle errors from API calls. Instead of showing a generic error message, provide user-friendly notifications. For 503 errors (Service Unavailable), the message should indicate that the system is busy and to try again later.
*   **Error Boundaries:** In your React components, use Error Boundaries to catch rendering errors and prevent a component crash from taking down the entire application. This is crucial for maintaining the overall availability of the UI.

**Recommended Settings:**

*   **Loading and Skeleton States:** Display loading indicators or skeleton screens while waiting for API responses. This gives the user immediate feedback that their request is being processed.
*   **Client-Side Retries (with caution):** For idempotent (safe to repeat) GET requests that fail with a transient error, you can implement a simple retry mechanism with a short delay. However, be mindful not to overwhelm the backend with retries. A single, immediate retry upon failure can sometimes resolve transient network issues.
*   **Server-Side Data Fetching Timeouts:** When using `getServerSideProps` or `getStaticProps`, be aware that slow API responses can increase your server response time. While Next.js doesn't have a built-in timeout for these functions, you can use a library like `p-timeout` to wrap your data fetching logic and enforce a timeout.

### App-API-Proxy - FastAPI Proxy with `httpx` and `httpx-retries`

This layer is critical for protecting your backend service and ensuring that the application as a whole remains resilient.

**Necessary Settings:**

*   **Timeouts:** Configure timeouts for all outgoing requests from the proxy to the backend service using `httpx`. This is a fundamental step to prevent the proxy from becoming a bottleneck.
*   **Retries with Exponential Backoff and Jitter:** Use the `httpx-retries` library to implement a robust retry strategy. This will help in recovering from transient failures in the backend service. A good starting point for your `RetryTransport` configuration would be:
    *   `total`: The maximum number of retries to attempt (e.g., 3).
    *   `backoff_factor`: A factor to apply to the delay between retries (e.g., 0.5). This will introduce an exponential delay.
    *   `status_forcelist`: A list of HTTP status codes that should trigger a retry (e.g., `[500, 502, 503, 504]`).
    *   **Jitter:** While `httpx-retries` doesn't have a dedicated jitter parameter, the exponential backoff provides a similar effect of spreading out retries. For more advanced jitter, you can customize the backoff strategy.
*   **Rate Limiting:** Your implementation of rate-limiting based on CPU/memory thresholds is a good start. This is a crucial defense against traffic spikes and can prevent cascading failures.

**Recommended Settings:**

*   **Circuit Breaker:** For maximum resilience, consider adding a circuit breaker pattern. A circuit breaker will stop sending requests to the backend service for a configured period after a certain number of consecutive failures. This gives the backend time to recover. Libraries like `pybreaker` can be integrated with your FastAPI application.
*   **Idempotent API Design:** Ensure that any API endpoints that are retried are idempotent, meaning that making the same request multiple times will not result in unintended side effects. This is especially important for POST, PUT, and DELETE requests.
*   **Logging and Monitoring:** Log retry attempts and failures to gain insights into the health of your backend service. Monitoring these logs can help you identify and address chronic issues.

### Backend Service - FastAPI Backend with SQLAlchemy and Oracle DB

The backend service needs to be able to handle requests from the proxy efficiently and manage its connections to the database effectively.

**Necessary Settings:**

*   **`sqlnet.ora` Configuration:** As you've noted, there is no direct way to configure connection timeouts in SQLAlchemy for Oracle. Therefore, it is necessary to create and configure a `sqlnet.ora` file in the Oracle client's `network/admin` directory within your pod. This file should contain the following parameters:
    *   `SQLNET.INBOUND_CONNECT_TIMEOUT`: Sets the time for the database server to wait for a client connection.
    *   `SQLNET.SEND_TIMEOUT`: Sets the time for the database server to wait for data from the client.
    *   `SQLNET.RECV_TIMEOUT`: Sets the time for the database server to wait for the client to receive data.
*   **SQLAlchemy Connection Pooling:** Use SQLAlchemy's connection pooling to manage database connections efficiently. The following settings are recommended:
    *   `pool_recycle`: Set this to a value lower than your database's connection timeout to prevent the pool from trying to use stale connections.
    *   `pool_pre_ping`: Set this to `True` to have the pool check the liveness of a connection before handing it to the application. This can add a small overhead but is a robust way to handle dropped connections.

**Recommended Settings:**

*   **Rate Limiting:** Your current implementation of rate-limiting based on CPU/memory thresholds is a good practice. This will protect your database from being overwhelmed.
*   **Asynchronous Database Operations:** If your application is I/O bound, consider using an async SQLAlchemy driver to take advantage of FastAPI's async capabilities. This can improve the responsiveness of your backend service.
*   **Query Optimization:** Ensure that your database queries are optimized to avoid long-running operations that could lead to timeouts. Use database indexes and analyze query execution plans.


## The Core Principle: The Timeout Waterfall

The fundamental rule is that timeouts must increase as you move up the stack from the database to the user interface. Each layer must have a timeout longer than the *total possible time* the layer below it might take, including all retries and backoffs.

`UI Timeout > API-Proxy Total Timeout (with retries) > Backend Timeout > Database Timeout`

---

### Layer 4: Oracle Database (`sqlnet.ora`)

This is the foundation. These timeouts should be the shortest, as they define the maximum wait time for a single network operation to the database. These settings go in the `sqlnet.ora` file located in the Oracle client's `network/admin` directory within your backend pod.

**File: `sqlnet.ora`**

```ini
# Specifies the time in seconds for a client to establish a TCP connection to the database server.
# This is a good first line of defense against network issues.
TCP.CONNECT_TIMEOUT = 5

# Specifies the time in seconds for the database server to wait for a client connection after which it times out.
# A slightly higher value than TCP.CONNECT_TIMEOUT is reasonable.
SQLNET.INBOUND_CONNECT_TIMEOUT = 8

# Specifies the time in seconds for the database to wait for data from the client.
# This can prevent hung sessions if a client dies mid-transaction.
SQLNET.SEND_TIMEOUT = 10

# Specifies the time in seconds for the client to wait for data from the database.
# This is the most critical one for long-running queries from a network perspective.
SQLNET.RECV_TIMEOUT = 10
```

*   **Total Effective DB Timeout:** Around **10-15 seconds** for a single operation to complete or fail.

---

### Layer 3: Backend Service (FastAPI + SQLAlchemy)

This layer's settings are focused on managing the database connection pool reliably. The timeout here is not set directly in the code but is dictated by the proxy that calls it.

**SQLAlchemy Engine Configuration:**

```python
from sqlalchemy import create_engine

# These settings ensure that connections are healthy and recycled before the database or a firewall drops them.
engine = create_engine(
    "oracle+cx_oracle://user:pass@host:port/service",
    pool_size=10,          # The number of connections to keep open in the pool.
    max_overflow=20,       # The number of additional connections that can be opened.
    pool_recycle=1800,     # Recycle connections every 30 minutes to prevent stale connections.
    pool_pre_ping=True,    # Check if a connection is alive before handing it to the application.
)
```

*   **Consideration:** The backend's own business logic will add processing time. Let's assume this is typically 1-2 seconds.
*   **Total Backend Response Time:** `DB Timeout (10s) + Processing Time (2s) = 12s`. To be safe, we'll design the proxy to wait up to **15 seconds** for a response from this layer.

---

### Layer 2: App-API-Proxy (FastAPI + `httpx`)

This is the most critical layer for resilience. Its total timeout is a combination of the single request timeout, the number of retries, and the backoff delay.

**`httpx` and `httpx-retries` Configuration:**

```python
from httpx import Timeout
from httpx_retries import RetryTransport
import httpx

# 1. Single Request Timeout: Must be greater than the backend's expected response time (15s).
timeout = Timeout(connect=5.0, read=16.0, write=5.0)

# 2. Retry Strategy
transport = RetryTransport(
    retries=3,                      # Attempt the initial request + 3 retries.
    backoff_factor=0.5,             # Exponential backoff delay: 0.5s, 1s, 2s.
    status_forcelist=[500, 502, 503, 504], # Only retry on these server-side transient errors.
    respect_retry_after_header=True
)

client = httpx.Client(transport=transport, timeout=timeout)
```

**Calculating the Total Worst-Case Timeout for the Proxy:**

Let's calculate the maximum time this layer could take before returning a final error to the UI:

*   **Initial Request:** 16 seconds
*   **Wait 1 (Backoff):** `0.5 * (2**0)` = 0.5 seconds
*   **Retry 1:** 16 seconds
*   **Wait 2 (Backoff):** `0.5 * (2**1)` = 1 second
*   **Retry 2:** 16 seconds
*   **Wait 3 (Backoff):** `0.5 * (2**2)` = 2 seconds
*   **Retry 3:** 16 seconds

**Total Proxy Timeout:** `16 + 0.5 + 16 + 1 + 16 + 2 + 16 =` **~67.5 seconds**

To be safe and account for small network latencies, we should plan for the proxy to take up to **70 seconds** in a worst-case failure scenario.

---

### Layer 1: UI-App (Next.js)

The UI must have the longest timeout to accommodate the entire retry cycle of the API-Proxy.

**API Call Configuration (Example using `fetch` with `AbortController`):**

```javascript
const controller = new AbortController();

// Set a timeout that is LONGER than the proxy's worst-case timeout of 70s.
const timeoutId = setTimeout(() => controller.abort(), 75000); // 75 seconds

try {
  const response = await fetch('/api/proxy/data', {
    signal: controller.signal
  });

  if (response.status === 503) {
    // Handle rate-limiting: "System is busy, please try again in a moment."
  }
  // ... handle other statuses
} catch (error) {
  if (error.name === 'AbortError') {
    // Handle timeout: "The request took too long to respond."
  } else {
    // Handle other network errors
  }
} finally {
  clearTimeout(timeoutId);
}
```

### Summary Table

| Layer | Configuration | Parameter | Suggested Value | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| **UI-App** | API Client | `timeout` | **75 seconds** | Must be greater than the Proxy's total worst-case time (~70s). |
| **App-API-Proxy** | `httpx` | `timeout` | **16 seconds** | Must be greater than the Backend's expected response time (~15s). |
| | `httpx-retries` | `retries` | **3** | A reasonable number of retries for transient faults. |
| | `httpx-retries` | `backoff_factor` | **0.5** | Provides increasing delays between retries (0.5s, 1s, 2s). |
| **Backend Service**| SQLAlchemy | `pool_recycle` | **1800** | Prevents using stale connections closed by firewalls. |
| | SQLAlchemy | `pool_pre_ping` | **True** | Ensures connection health before use, improving reliability. |
| **Oracle DB** | `sqlnet.ora` | `TCP.CONNECT_TIMEOUT` | **5 seconds** | Fails fast on initial network connection issues. |
| | `sqlnet.ora` | `SQLNET.RECV_TIMEOUT` | **10 seconds** | Defines the base network timeout for receiving data. |

