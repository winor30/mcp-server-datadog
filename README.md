# Datadog MCP Server

MCP server for the Datadog API, enabling incident management and more.

## Features

- **Observability Tools**: Provides a mechanism to leverage key Datadog monitoring features, such as incidents, monitors, logs, dashboards, and metrics, through the MCP server.
- **Extensible Design**: Designed to easily integrate with additional Datadog APIs, allowing for seamless future feature expansion.

## Tools

1. `list_incidents`

   - Retrieve a list of incidents from Datadog.
   - **Inputs**:
     - `filter` (optional string): Filter parameters for incidents (e.g., status, priority).
     - `pagination` (optional object): Pagination details like page size/offset.
   - **Returns**: Array of Datadog incidents and associated metadata.

2. `get_incident`

   - Retrieve detailed information about a specific Datadog incident.
   - **Inputs**:
     - `incident_id` (string): Incident ID to fetch details for.
   - **Returns**: Detailed incident information (title, status, timestamps, etc.).

3. `get_monitors`
   - Fetch the status of Datadog monitors.
   - **Inputs**:
     - `groupStates` (optional array): States to filter (e.g., alert, warn, no data, ok).
     - `name` (optional string): Filter by name.
     - `tags` (optional array): Filter by tags.
   - **Returns**: Monitors data and a summary of their statuses.

4. `get_logs`
   - Search and retrieve logs from Datadog.
   - **Inputs**:
     - `query` (string): Datadog logs query string.
     - `from` (number): Start time in epoch seconds.
     - `to` (number): End time in epoch seconds.
     - `limit` (optional number): Maximum number of logs to return (defaults to 100).
   - **Returns**: Array of matching logs.

5. `list_dashboards`
   - Get a list of dashboards from Datadog.
   - **Inputs**:
     - `name` (optional string): Filter dashboards by name.
     - `tags` (optional array): Filter dashboards by tags.
   - **Returns**: Array of dashboards with URL references.

6. `get_metrics`
   - Retrieve metrics data from Datadog.
   - **Inputs**:
     - `query` (string): Metrics query string.
     - `from` (number): Start time in epoch seconds.
     - `to` (number): End time in epoch seconds.
   - **Returns**: Metrics data for the queried timeframe.

## Setup

### Datadog Credentials

You need valid Datadog API credentials to use this MCP server:

- `DATADOG_API_KEY`: Your Datadog API key
- `DATADOG_APP_KEY`: Your Datadog Application key
- `DATADOG_SITE` (optional): The Datadog site (e.g. `datadoghq.eu`)

Export them in your environment before running the server:

```bash
export DATADOG_API_KEY="your_api_key"
export DATADOG_APP_KEY="your_app_key"
export DATADOG_SITE="your_datadog_site"
```

## Installation

```bash
pnpm install
pnpm build
pnpm watch   # for development with auto-rebuild
```

## Usage with Claude Desktop

To use this with Claude Desktop, add the following to your `claude_desktop_config.json`:

On MacOS: `~/Library/Application Support/Claude/claude_desktop_config.json`  
On Windows: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "<YOUR_TOKEN>"
      }
    }
  }
}
```

```json
{
  "mcpServers": {
    "datadog": {
      "command": "/path/to/mcp-server-datadog/build/index.js",
      "env": {
        "DATADOG_API_KEY": "<YOUR_API_KEY>",
        "DATADOG_APP_KEY": "<YOUR_APP_KEY>",
        "DATADOG_SITE": "<YOUR_SITE>" // Optional
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
        "DATADOG_SITE": "<YOUR_SITE>" // Optional
      }
    }
  }
}
```

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