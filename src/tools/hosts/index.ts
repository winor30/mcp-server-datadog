/**
 * Central export file for the Datadog Hosts management tools.
 * Re-exports the tools and their handlers from the implementation file.
 *
 * HOSTS_TOOLS: Array of tool schemas defining the available host management operations
 * createHostsToolHandlers: Function that creates host management operation handlers
 */
export { HOSTS_TOOLS, createHostsToolHandlers } from './tool'
