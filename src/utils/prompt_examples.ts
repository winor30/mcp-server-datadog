/**
 * Example prompts and responses for the Datadog MCP Server
 * These can be used for training, documentation, or as templates
 */

/**
 * Examples of common root cause analysis scenarios
 */
export const RCA_EXAMPLES = {
  monitorAlert: {
    userPrompt: `I received an alert for monitor #12345678 about high error rates. Can you help analyze what's happening?`,

    assistantResponse: `I'll analyze this high error rate alert. Let me gather the information about this monitor and recent errors.

First, I'll check the monitor details and recent events, then look at logs around the alert time to understand what errors are occurring. I'll also check for any related deployments or infrastructure changes that might explain this spike in errors.

Here's what I've found:

- **Monitor Details**: "API Error Rate" monitor triggered at 14:32 UTC reaching 5.2% errors (threshold: 2%)
- **Affected Services**: checkout-service, payment-gateway
- **Primary Error Types**: 
  - 72% - "Connection timeout to payment-processor" 
  - 18% - "Database query timeout in transaction processing"
- **Related Changes**: Deployment of v2.5.3 occurred 45 minutes before alert
- **Infrastructure Status**: No scaling or host issues detected
- **Anomalous Patterns**: Detected 3x increase in database query time before errors started

**Root Cause Analysis**:
The recent deployment (v2.5.3) modified the payment processing flow, which appears to have introduced a database query that's causing timeouts under load. This is cascading to the external payment processor connection which can't complete transactions in time.

**Recommended Actions**:
1. Examine the query changes in the latest deployment (specifically in transaction_handler.js)
2. Check for missing indexes or N+1 query patterns
3. Consider reverting to v2.5.2 if immediate fix isn't possible

Would you like me to look into any specific aspect in more detail?`,
  },

  specificLog: {
    userPrompt: `I found this error in our logs: "TypeError: Cannot read property 'subscription' of undefined at /app/src/billing/processor.js:127:23". Can you help me figure out what's going on?`,

    assistantResponse: `I'll help analyze this TypeError in the billing processor. Let me investigate the logs, code context, and related issues.

This error occurs when the code tries to access a 'subscription' property on an undefined object in the billing processor. Let me check for patterns and context around this error.

Here's what I've found:

- **Error Frequency**: This error has occurred 47 times in the past 3 hours
- **Affected Users**: Primarily impacting premium tier customers
- **Pattern Analysis**: Error occurs during billing cycle renewal attempts
- **Code Context**: The error is in processor.js line 127, where it's trying to access user.account.subscription
- **Related Issues**: Similar errors started after the user account schema migration (deployed yesterday)
- **Impact**: Failed subscription renewals for approximately 3% of attempts

**Root Cause Analysis**:
This appears to be related to the recent account schema migration, where some premium user accounts don't have the expected account structure. The code at processor.js:127 isn't handling the case where user.account might be undefined.

**Suggested Fix**:
Add null-check before accessing the subscription property:
\`\`\`javascript
// In processor.js around line 127
const subscriptionType = user?.account?.subscription?.type || 'default';
\`\`\`

**Immediate Mitigation**:
Consider pausing automatic renewals until fix is deployed, or add logging to identify affected user accounts for manual renewal.

Would you like me to look at the full code context or investigate which specific user accounts are affected?`,
  },

  findRegressions: {
    userPrompt: `Can you find any performance regressions in our system over the past 24 hours?`,

    assistantResponse: `I'll analyze system performance over the past 24 hours to identify any regressions. Let me check metrics, logs, SLOs, and recent changes.

Here's my analysis of performance regressions in the past 24 hours:

**Identified Regressions**:

1. **API Response Time (High Severity)**
   - 35% increase in p95 latency for /api/search endpoint starting at 09:15 UTC
   - Coincides with deployment of search-optimization-v3 (commit a7d234f)
   - SLO impact: Search Latency SLO error budget consumption increased by 32%
   - Root cause: New text analysis function is causing excessive DB load

2. **Database Query Performance (Medium Severity)**
   - 28% increase in average query time for product catalog operations
   - Started gradually around 15:30 UTC
   - Correlates with 22% growth in product catalog size from batch import
   - No deployment correlation, appears to be data volume related

3. **Login Flow (Low Severity)**
   - 12% increase in authentication time
   - Irregular pattern, primarily affecting European region users
   - Correlates with third-party identity provider maintenance window
   - Expected to resolve automatically after their maintenance

**Recommendations**:
1. Revert or fix the search optimization feature (highest priority)
2. Add indexes to product catalog tables to handle increased volume
3. Monitor the authentication flow as the identity provider completes maintenance

Would you like me to dive deeper into any of these regressions?`,
  },

  findAnomalies: {
    userPrompt: `Please check for any unusual patterns or anomalies in our system in the past 12 hours.`,

    assistantResponse: `I'll scan for anomalies and unusual patterns across our system for the past 12 hours. Let me check logs, metrics, and events for unexpected behaviors.

Here are the anomalies I've detected in the past 12 hours:

**1. Unusual Error Pattern (High Significance)**
   - New error signature: "Invalid state transition: pending → fulfilled" 
   - 127 occurrences, first appeared at 03:42 UTC
   - Only affects orders with multiple shipment locations
   - No previous occurrences of this error pattern in baseline period
   - Confidence: High (z-score: 4.7)

**2. API Traffic Anomaly (Medium Significance)**
   - 3.8x increase in requests to /api/legacy/export endpoint
   - Started at 08:15 UTC, continuing with consistent pattern
   - Coming from small number of IP addresses, all legitimate partners
   - No performance impact yet, but unusual access pattern
   - Confidence: Medium (z-score: 3.2)

**3. Infrastructure Behavior (Medium Significance)**
   - Unusual memory usage pattern in Redis cluster
   - Sawtooth pattern with rapid grows/drops instead of normal gradual curve
   - No performance impact detected yet
   - Coincides with new caching strategy deployment
   - Confidence: Medium (z-score: 2.9)

**4. User Behavior Shift (Low Significance)**
   - 22% decrease in checkout completion rate
   - Only for mobile Android users on version 4.2.1
   - Correlates with new A/B test of checkout flow
   - Expected but worth monitoring for business impact
   - Confidence: High (verified A/B test running)

Would you like me to investigate any of these anomalies in more detail?`,
  },
}

/**
 * Example of integrating RCA findings with codebase investigation
 */
export const CODE_INTEGRATION_EXAMPLE = {
  userPrompt: `We're getting timeouts in the payment processing service, can you find what might be causing it?`,

  assistantResponse: `I'll investigate the payment processing timeouts by looking at both Datadog signals and the codebase.

First, I'll check recent logs and metrics for the payment service, then correlate any findings with the code.

Here's what I've discovered:

**Datadog Analysis**:
- **Error Pattern**: "Database connection timeout after 30000ms" errors increased 500% in the past hour
- **Performance Metrics**: Database query latency spiked from avg 85ms to 3200ms
- **Resource Usage**: Database CPU at 95% utilization, up from normal 40-60% range
- **Anomalies**: New query pattern detected with high frequency, first seen at 14:20 UTC

**Code Investigation**:
Looking at the codebase, I found the issue in \`src/services/payments/processor.js\`:

\`\`\`javascript
// This function was modified in the latest deployment (commit 8f2a9d)
async function processRecurringPayments() {
  // The issue is in this query - it's not using an index and doing a full table scan
  const users = await db.query(
    'SELECT * FROM users WHERE subscription_status = ?', 
    ['active']
  );
  
  // This nested loop creates N queries for N users - classic N+1 problem
  for (const user of users) {
    const payments = await db.query(
      'SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC',
      [user.id]
    );
    
    // Process each payment...
  }
}
\`\`\`

**Root Cause**:
The recent change to the recurring payment processor introduced an N+1 query pattern. With ~12,000 active subscribers, this creates 12,001 database queries (1 for users + 12,000 for their payments), overwhelming the database.

**Fix Recommendation**:
1. Modify the query to join users and payments tables:
\`\`\`javascript
const userPayments = await db.query(
  'SELECT u.*, p.* FROM users u ' +
  'LEFT JOIN payments p ON u.id = p.user_id ' +
  'WHERE u.subscription_status = ? ' +
  'ORDER BY p.created_at DESC',
  ['active']
);

// Then process the joined results without additional queries
\`\`\`

2. Add appropriate indexes to support this query pattern.

Would you like me to implement this fix or investigate other potential issues?`,
}

/**
 * Examples for monitor-specific analysis
 */
export const MONITOR_TYPE_EXAMPLES = {
  availability: {
    userPrompt: `Our API availability monitor is alerting with a 7% error rate. Can you investigate?`,

    assistantResponse: `For an availability issue, I'll focus on infrastructure, network, and recent changes that could cause downtime.

My analysis shows:
- 7% of API requests are failing with 503 Service Unavailable responses
- The issue started at 15:22 UTC, coinciding with a traffic spike (2.3x normal load)
- Database connection pool metrics show 100% utilization
- Database CPU and memory look normal
- No recent deployments or config changes

Root cause: The application's database connection pool is exhausted under higher load, causing some requests to fail when they can't get a connection.

Recommended fix: Increase the connection pool size in src/config/database.js from the current 20 to at least 50 based on peak traffic patterns.`,
  },

  latency: {
    userPrompt: `Our checkout latency monitor is showing response times have doubled. What's happening?`,

    assistantResponse: `For a latency issue, I'll focus on performance bottlenecks, resource contention, and code changes affecting response time.

My analysis shows:
- Checkout API p95 latency increased from 235ms to 470ms starting at 08:45 UTC
- Database query time for product_inventory lookups increased by 310%
- The inventory table has grown by 15M rows in the past 24 hours
- EXPLAIN ANALYZE shows the query is no longer using the expected index
- Recent deployment added inventory_location_id to the schema

Root cause: The schema change invalidated the existing index strategy for inventory lookups.

Recommended fix: Add a composite index on (product_id, inventory_location_id) in the database and modify the query in src/services/inventory.js to utilize this index.`,
  },
}

/**
 * Examples for severity-based analysis approaches
 */
export const SEVERITY_EXAMPLES = {
  critical: {
    analysisApproach: `
For this CRITICAL issue, I'm performing a comprehensive analysis:

1. Examined 12 hours before and 6 hours after the incident
2. Analyzed all services in the request path and their dependencies 
3. Checked all recent deployments across affected services
4. Reviewed infrastructure metrics for all related components
5. Correlated with customer impact data
6. Analyzed similar historical incidents

This thorough approach helps ensure we catch cascading effects and identify all contributing factors to this business-critical issue.`,
  },

  warning: {
    analysisApproach: `
For this WARNING-level issue, I'm using a focused analysis approach:

1. Examined 2 hours around the warning trigger time
2. Focused on the specific service and its immediate dependencies
3. Checked for patterns that might escalate this to a critical issue
4. Evaluated whether monitoring thresholds are appropriate

This balanced approach helps identify the direct cause without over-analyzing a non-critical issue.`,
  },
}
