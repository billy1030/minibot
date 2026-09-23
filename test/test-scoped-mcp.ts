import { ScopedMCPManager } from "../src/mcp/scoped-mcp-manager.js";
import { MCPClientManager } from "../src/mcp/client-manager.js";
import fs from "node:fs";

async function testScopedMCP() {
  console.log("=== Testing 3-Tier Scoped MCP Architecture ===");

  const sysClient = new MCPClientManager();
  const scopedManager = new ScopedMCPManager(sysClient);

  const testUser = "99999";
  const testWs = "test-finance";

  // 1. Save and read User-global MCP server
  console.log("1. Testing User Global Scope...");
  scopedManager.saveUserServers({
    "user-personal-db": {
      type: "stdio",
      command: "echo",
      args: ["user-db"],
      enabled: false,
      description: "User personal DB test"
    }
  }, testUser);

  const userServers = scopedManager.readUserServers(testUser);
  if (!userServers["user-personal-db"]) {
    throw new Error("Failed to read user-level MCP server");
  }
  console.log("✔ User Global server saved and retrieved successfully.");

  // 2. Save and read Workspace-local MCP server
  console.log("2. Testing Workspace Local Scope...");
  scopedManager.saveWorkspaceServers({
    "mini-news-finance": {
      type: "stdio",
      command: "echo",
      args: ["mini-news"],
      enabled: false,
      description: "Workspace local financial news"
    }
  }, testWs, testUser);

  const wsServers = scopedManager.readWorkspaceServers(testWs, testUser);
  if (!wsServers["mini-news-finance"]) {
    throw new Error("Failed to read workspace-level MCP server");
  }
  console.log("✔ Workspace Local server saved and retrieved successfully.");

  // 3. Verify Isolation between workspaces
  const otherWsServers = scopedManager.readWorkspaceServers("test-general", testUser);
  if (otherWsServers["mini-news-finance"]) {
    throw new Error("Isolation failure: workspace server leaked into another workspace!");
  }
  console.log("✔ Workspace isolation verified: other workspace does not have access.");

  // 4. Verify Isolation between users
  const otherUserServers = scopedManager.readUserServers("88888");
  if (otherUserServers["user-personal-db"]) {
    throw new Error("Isolation failure: user server leaked to another user!");
  }
  console.log("✔ User isolation verified: other user does not have access.");

  // Clean up test files
  try {
    fs.rmSync(scopedManager.getUserConfigPath(testUser), { force: true });
    fs.rmSync(scopedManager.getWorkspaceConfigPath(testWs, testUser), { force: true });
  } catch {}

  console.log("=== All Scoped MCP Architecture Tests Passed! ===");
}

testScopedMCP().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
