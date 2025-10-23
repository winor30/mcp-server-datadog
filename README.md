# Datadog MCP Server

> **DISCLAIMER**: This is a community-maintained project and is not officially affiliated with, endorsed by, or supported by Datadog, Inc. This MCP server utilizes the Datadog API but is developed independently as part of the [Model Context Protocol](https://github.com/modelcontextprotocol/servers) ecosystem.

![NPM Version](https://img.shields.io/npm/v/%40winor30%2Fmcp-server-datadog)![Build and Test](https://github.com/winor30/mcp-server-datadog/actions/workflows/ci.yml/badge.svg)[![codecov](https://codecov.io/gh/winor30/mcp-server-datadog/graph/badge.svg?token=BG4ZB74X92)](https://codecov.io/gh/winor30/mcp-server-datadog)[![smithery badge](https://smithery.ai/badge/@winor30/mcp-server-datadog)](https://smithery.ai/server/@winor30/mcp-server-datadog)

An MCP server that enables AI assistants to access and analyze Datadog monitoring data, manage incidents, and perform root cause analysis.

<a href="https://glama.ai/mcp/servers/bu8gtzkwfr">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/bu8gtzkwfr/badge" alt="mcp-server-datadog MCP server" />
</a>

## Quick Start

1. **Install**: `npx -y @smithery/cli install @winor30/mcp-server-datadog --client claude`
2. **Configure**: Add your Datadog credentials (see [Setup](#setup))
3. **Use**: Start asking your AI assistant questions about your Datadog environment

## Usage Examples

Ask your AI assistant questions about your Datadog environment:

- **Incidents** - "Show me active incidents" or "Get details on incident X"
- **Monitors** -
  - "Which monitors are in alert state?"
  - "Show active monitor alerts with the tag env:prod"
  - "Show active monitor alerts with the tag env:prod and priority P2 (high)."
- **Logs** - "Find error logs from the past hour" or "Show authentication failures in service Z"
- **Metrics** - "What's the CPU usage trend?" or "Graph memory consumption for host A"
- **Dashboards** - "List dashboards for service B" or "Show me dashboard X"
- **Traces** - "Find slow requests in the payment service" or "Show me trace performance by endpoint"
- **Hosts** - "List problematic hosts" or "Is host C experiencing issues?"
- **RUM** - "What's the page load time for our checkout page?" or "Show performance metrics for our mobile app"
- **Root Cause Analysis** - "Investigate alert from monitor X" or "Find what's causing these errors"

For advanced root cause analysis capabilities, see these dedicated guides:

- [**Root Cause Analysis Guide**](README-ROOTCAUSE.md) - Detailed instructions on using investigation chains for systematic troubleshooting. Includes practical examples for investigating monitor alerts, error logs, and performance regressions. Learn how to automate multi-step analysis workflows to efficiently find the root cause of issues.

- [**RCA Features Documentation**](README-RCA.md) - Comprehensive overview of advanced pattern analysis, anomaly detection, and SLO monitoring capabilities. Contains example queries, usage scenarios, and implementation details for extracting insights from your monitoring data.

## Features

- **Observability Tools**: Access key Datadog monitoring features through conversational AI queries
- **Advanced Root Cause Analysis**: Specialized tools for log pattern analysis, error signature extraction, anomaly detection, and SLO monitoring
- **Automated Investigation Chains**: Predefined analysis sequences for common scenarios like monitor alerts, error logs, and performance regressions
- **Contextual Guidance**: Scenario-specific guidance for different troubleshooting situations
- **Extensible Design**: Easily integrate with additional Datadog APIs for future expansion

## Setup

### Datadog Credentials

You need valid Datadog API credentials to use this MCP server:

- `DATADOG_API_KEY`: Your Datadog API key
- `DATADOG_APP_KEY`: Your Datadog Application key
- `DATADOG_SITE` (optional): The Datadog site (e.g. `datadoghq.eu`)
- `DATADOG_SUBDOMAIN` (optional): The Datadog subdomain (e.g. `<your-subdomain>.datadoghq.com`)

Export them in your environment before running the server:

```bash
export DATADOG_API_KEY="your_api_key"
export DATADOG_APP_KEY="your_app_key"
export DATADOG_SITE="your_datadog_site" # Optional
export DATADOG_SUBDOMAIN="your_datadog_subdomain" # Optional
```

## Installation

### Installing via Smithery

To install Datadog MCP Server for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@winor30/mcp-server-datadog):

```bash
npx -y @smithery/cli install @winor30/mcp-server-datadog --client claude
```

### Manual Installation

```bash
pnpm install
pnpm build
pnpm watch   # for development with auto-rebuild
```

## Integration with Claude Desktop

To use this with Claude Desktop, add the following to your `claude_desktop_config.json`:

On MacOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
On Windows: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "datadog": {
      "command": "/path/to/mcp-server-datadog/build/index.js",
      "env": {
        "DATADOG_API_KEY": "<YOUR_API_KEY>",
        "DATADOG_APP_KEY": "<YOUR_APP_KEY>",
        "DATADOG_SITE": "<YOUR_SITE>", // Optional
        "DATADOG_SUBDOMAIN": "<YOUR_SUBDOMAIN>" // Optional
      }
    }
  }
}
```

Or specify via `npx`:

```json
{
  "mcpServers": {
    "mcp-server-datadog": {
      "command": "npx",
      "args": ["-y", "@winor30/mcp-server-datadog"],
      "env": {
        "DATADOG_API_KEY": "<YOUR_API_KEY>",
        "DATADOG_APP_KEY": "<YOUR_APP_KEY>",
        "DATADOG_SITE": "<YOUR_SITE>", // Optional
        "DATADOG_SUBDOMAIN": "<YOUR_SUBDOMAIN>" // Optional
      }
    }
  }
}
```

## Available Tools

### Core Datadog Tools

1. **Incidents**

   - `list_incidents` - Get a list of Datadog incidents
   - `get_incident` - Get detailed information about a specific incident

2. **Monitors**

   - `get_monitors` - Get status of monitors with filtering options
   - `get_monitor_event` - Get specific monitor event details

3. **Logs**

   - `get_logs` - Search and retrieve logs with filtering
   - `get_all_services` - Extract all unique service names from logs

4. **Metrics**

   - `query_metrics` - Get metric data for specified time ranges

5. **Dashboards**

   - `list_dashboards` - List available dashboards
   - `get_dashboard` - View detailed dashboard information

6. **Traces**

   - `list_traces` - Get APM traces filtered by service, operation, etc.

7. **Hosts**

   - `list_hosts` - List hosts with detailed information
   - `get_active_hosts_count` - Count active hosts
   - `mute_host` - Temporarily mute a host
   - `unmute_host` - Re-enable alerting for a host

8. **Downtimes**

   - `list_downtimes` - View scheduled maintenance windows
   - `schedule_downtime` - Create a new maintenance window
   - `cancel_downtime` - Cancel a scheduled downtime

9. **Real User Monitoring (RUM)**
   - `get_rum_applications` - List RUM-enabled applications
   - `get_rum_events` - Get RUM events for analysis
   - `get_rum_grouped_event_count` - Get grouped RUM event counts
   - `get_rum_page_performance` - Get page load and performance metrics
   - `get_rum_page_waterfall` - Get detailed page load waterfall data

### Advanced Root Cause Analysis Tools

1. **Log Pattern Analysis**

   - `find_log_patterns` - Group similar log messages
   - `extract_error_signatures` - Categorize errors by type and location
   - `detect_anomalous_patterns` - Find unusual log patterns compared to baseline

2. **Anomaly Detection**

   - `get_anomalies` - Find anomalies in metrics with various algorithms

3. **Service Level Objectives (SLOs)**

   - `list_slos` - Search available SLOs
   - `get_slo` - Get detailed SLO information
   - `get_slo_history` - View SLO history with error budget tracking
   - `check_slos` - Find SLOs at risk of breaching

4. **Events**

   - `list_events` - Search the event stream
   - `get_event` - Get detailed event information
   - `create_event` - Create a new event

5. **Investigation Chains**
   - `execute_investigation_chain` - Run predefined analysis workflows
   - `detect_and_execute_chain` - Automatically select and run appropriate workflows
   - `list_investigation_chains` - See available investigation workflows

For detailed API parameters and advanced usage examples:

- [**RCA Features Documentation**](README-RCA.md) provides detailed API specifications, example queries for each tool, and insights on best practices for pattern analysis and anomaly detection
- [**Root Cause Analysis Guide**](README-ROOTCAUSE.md) offers step-by-step guidance on setting up and using investigation chains for coordinated, multi-step troubleshooting workflows

## Debugging

Because MCP servers communicate over standard input/output, debugging can sometimes be tricky. We recommend using the [MCP Inspector](https://github.com/modelcontextprotocol/inspector). You can run the inspector with:

```bash
npm run inspector
```

The inspector will provide a URL you can open in your browser to see logs and send requests manually.

## Contributing

Contributions are welcome! Feel free to open an issue or a pull request if you have any suggestions, bug reports, or improvements to propose.

## License

This project is licensed under the [Apache License, Version 2.0](./LICENSE).
