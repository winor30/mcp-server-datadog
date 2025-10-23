# Datadog MCP Server for Root Cause Analysis

This extension to the [Datadog MCP Server](README.md) adds advanced root cause analysis capabilities to help with troubleshooting and monitoring.

## 🔍 New Root Cause Analysis Features

### 1. Log Pattern Analysis

- **Find Log Patterns**: Automatically group and cluster similar log messages to identify recurring patterns

  ```
  datadog:find_log_patterns (MCP)(
    from: 1683000000,
    to: 1683100000,
    query: "service:payment-api status:error",
    similarity_threshold: 0.7,
    min_occurrences: 5
  )
  ```

- **Extract Error Signatures**: Group and categorize errors by type, location, and stack trace

  ```
  datadog:extract_error_signatures (MCP)(
    from: 1683000000,
    to: 1683100000,
    query: "status:error",
    group_by_location: true,
    extract_stack_frames: 3
  )
  ```

- **Detect Anomalous Patterns**: Find unusual patterns by comparing with a baseline period
  ```
  datadog:detect_anomalous_patterns (MCP)(
    from: 1683000000,
    to: 1683100000,
    baseline_from: 1682900000,
    baseline_to: 1683000000,
    query: "service:api-gateway",
    sensitivity: 7
  )
  ```

### 2. Service Level Objective (SLO) Analysis

- **List SLOs**: Search and filter service level objectives

  ```
  datadog:list_slos (MCP)(
    query: "api",
    tags: ["tier:1", "env:production"]
  )
  ```

- **Get SLO Details**: View comprehensive information about a specific SLO

  ```
  datadog:get_slo (MCP)(
    id: "abc123def456"
  )
  ```

- **Get SLO History**: Analyze historical SLO performance with error budget tracking

  ```
  datadog:get_slo_history (MCP)(
    id: "abc123def456",
    from: 1683000000,
    to: 1683100000,
    show_error_budget: true,
    show_burn_rate: true
  )
  ```

- **Check SLOs at Risk**: Quickly identify SLOs that are at risk of breaching
  ```
  datadog:check_slos (MCP)(
    tags: ["env:production"],
    timeframe: "7d",
    threshold: 50
  )
  ```

### 3. Event Stream Analysis

- **List Events**: Search and filter the event stream

  ```
  datadog:list_events (MCP)(
    start: 1683000000,
    end: 1683100000,
    sources: ["deployment", "nagios"],
    tags: ["env:production"]
  )
  ```

- **Get Event Details**: View comprehensive information about a specific event

  ```
  datadog:get_event (MCP)(
    eventId: 1234567890
  )
  ```

- **Create Event**: Add custom events to the event stream
  ```
  datadog:create_event (MCP)(
    title: "Manual failover initiated",
    text: "Failing over to backup database due to primary latency issues",
    tags: ["database", "failover", "manual"],
    alertType: "info"
  )
  ```

## 📝 Automatic Scenario Guidance

The server now includes built-in guidance for different troubleshooting scenarios that will be automatically detected:

1. **Monitor/Alert Analysis**: When investigating a triggered monitor
2. **Log Analysis**: When troubleshooting specific logs or errors
3. **Regression Detection**: When looking for recent performance degradations
4. **Anomaly Detection**: When scanning for unusual patterns or behaviors

## 🔄 Using Root Cause Analysis Workflows

### Investigating a Monitor Alert

```
I received an alert for monitor #12345678 about high error rates. Can you help analyze what's happening?
```

The system will:

1. Extract the monitor ID and fetch its details
2. Get recent events for this monitor
3. Check related SLOs that might be impacted
4. Analyze logs during the alert period and detect error patterns
5. Check metrics, recent deployments, and infrastructure
6. Generate a comprehensive report

### Analyzing a Specific Log

```
I found this error in our logs: "TypeError: Cannot read property 'id' of undefined at /app/src/users/controller.js:45:12". What's going on?
```

The system will:

1. Find similar logs around the same timeframe
2. Extract the error signature
3. Look for anomalies around this time
4. Find related traces and metrics
5. Provide a detailed analysis with potential code issues

### Finding Recent Regressions

```
Can you find any performance regressions in our system over the past 24 hours?
```

The system will:

1. Check for SLO regression across services
2. Query key performance metrics with time comparison
3. Identify new error patterns
4. Compare with deployment events
5. Provide a regression report with severity assessment

### Detecting Anomalies

```
Please check for any unusual patterns or anomalies in our payment service in the past 6 hours.
```

The system will:

1. Use log pattern analysis to find unusual patterns
2. Check metrics for anomalies
3. Examine RUM data for frontend issues
4. Look for unusual infrastructure patterns
5. Provide an anomaly report with severity ranking

## 🛠️ Implementation Details

This functionality is implemented using:

1. **Custom Pattern Recognition Algorithms**: String similarity, tokenization, and hierarchical clustering
2. **Statistical Analysis**: Z-scores, trend analysis, and anomaly detection
3. **Smart Pagination**: Efficient handling of large datasets with timeouts and pagination
4. **Context Detection**: Automatic identification of scenario types from user queries

## 📋 Installation

Follow the standard [installation instructions](README.md#installation) for the Datadog MCP Server.

## ⚙️ Configuration

No additional configuration is required for the root cause analysis features beyond the standard Datadog API credentials.

## 🔗 See Also

- [MCP Server for Datadog - Main Documentation](README.md)
- [Model Context Protocol](https://github.com/modelcontextprotocol/servers)
- [Datadog API Documentation](https://docs.datadoghq.com/api/)
