# Root Cause Analysis with Datadog MCP Server

This guide explains how to use the advanced root cause analysis features in the Datadog MCP server.

## Investigation Chains

Investigation chains are predefined sequences of Datadog API calls that follow best practices for investigating different types of issues. They automate the process of gathering relevant information during incident response.

### Available Investigation Chains

- **Monitor Alert Investigation** (`monitor_alert`): For investigating triggered monitor alerts
- **Error Log Investigation** (`error_log`): For analyzing specific error logs or patterns
- **Performance Regression Investigation** (`performance_regression`): For investigating slowdowns
- **New Error Investigation** (`new_error`): For analyzing newly detected error types
- **Service Dependency Investigation** (`service_dependency`): For troubleshooting service dependencies
- **Infrastructure Investigation** (`infrastructure`): For investigating infrastructure issues

### Using Investigation Chains

There are three main ways to use investigation chains:

#### 1. Automatic Chain Detection and Execution

The simplest approach is to let the system automatically detect which chain to use based on your description of the problem:

```
datadog:detect_and_execute_chain (MCP)(
  userInput: "Monitor 12345 is triggering repeatedly with high error rates"
)
```

The system will analyze your input, identify that it's a monitor alert investigation, extract the monitor ID (12345), and automatically run the appropriate investigation chain.

#### 2. Manual Chain Execution

If you know which investigation chain you need, you can run it directly:

```
datadog:execute_investigation_chain (MCP)(
  chainId: "error_log",
  initialVariables: {
    "error_type": "TypeError",
    "service": "payment-api"
  }
)
```

#### 3. Viewing Available Chains

To see all available investigation chains:

```
datadog:list_investigation_chains (MCP)(
  detailed: true
)
```

Set `detailed: true` to see all the steps in each chain.

## Example Investigation Scenarios

### Investigating a Monitor Alert

```
datadog:detect_and_execute_chain (MCP)(
  userInput: "Monitor 12345 for the payment service is alerting with high error rates"
)
```

This will automatically:

1. Get details about monitor 12345
2. Check recent events for this monitor
3. Check if any SLOs are affected
4. Extract error signatures from logs during the alert period
5. Look for anomalous log patterns compared to the baseline
6. Check for recent deployments that might have triggered the issue
7. Examine relevant metrics

### Investigating an Error Log

```
datadog:execute_investigation_chain (MCP)(
  chainId: "error_log",
  initialVariables: {
    "log_id": "AAAAAXGLdD0AAABPV-5whqgB",
    "service": "checkout-service"
  }
)
```

This will:

1. Get the full details of the specified log
2. Find similar error patterns around the same time
3. Extract the error signature and categorize it
4. Find related traces for execution context
5. Check if any monitors for this service are in alert state
6. Check for recent deployments to this service
7. Examine service metrics around the time of the error

### Checking for Performance Regressions

```
datadog:detect_and_execute_chain (MCP)(
  userInput: "Our API service has gotten slower in the past 24 hours"
)
```

This will automatically:

1. Check SLO status for relevant services
2. Analyze SLO history for degradation patterns
3. Query critical performance metrics
4. Look for unusual log patterns
5. Check recent deployments
6. Examine database and infrastructure metrics
7. Check RUM data for frontend performance

## Advanced Usage: Custom Investigation Chains

For advanced users, it's possible to create custom investigation chains by modifying the code. The investigation chains are defined in `src/utils/investigation_chains.ts`.

Each chain consists of:

- A name and description
- A trigger pattern for automatic detection
- A sequence of steps, each using a specific Datadog tool

## Troubleshooting

### Chain Execution Issues

If a chain fails to execute, check:

1. Whether you have the necessary Datadog permissions for all API calls
2. If your variables match the expected format (monitor IDs, time ranges, etc.)
3. The logs for more detailed error information

### Performance Considerations

Investigation chains can make multiple API calls to Datadog. For large environments or long time ranges, consider:

1. Using smaller time windows for initial investigation
2. Setting appropriate limits for log and event queries
3. Using more specific filters (service names, tags, etc.) to reduce data volume

## Related Documentation

- [Main Datadog MCP Server Documentation](README.md)
- [Datadog API Documentation](https://docs.datadoghq.com/api/)
- [Model Context Protocol](https://github.com/modelcontextprotocol/servers)
