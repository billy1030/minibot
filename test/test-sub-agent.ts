import { loadConfig } from "../src/config/index.js";
import { MCPClientManager } from "../src/mcp/client-manager.js";
import { SubAgentExecutor } from "../src/engine/sub-agent-executor.js";

async function testSubAgent() {
  console.log("=== Testing MiniBot Multi-Agent (SubAgentExecutor) ===");

  const config = loadConfig();
  const mcpManager = new MCPClientManager();
  await mcpManager.initialize(config.mcpServers);

  console.log("\n[Test 1] Executing Researcher Sub-Agent...");
  const subAgentEvents: any[] = [];

  const result = await SubAgentExecutor.runSubAgent(
    {
      role: "researcher",
      taskInstruction: "What is Model Context Protocol (MCP) in 2 concise sentences?",
      workspace: "default",
      userNumber: "00000",
      maxIterations: 4,
    },
    config,
    mcpManager,
    {
      onSubAgentEvent: (event) => {
        subAgentEvents.push(event);
        console.log(`  -> SubAgent Event: [${event.type}] role=${event.role}`);
      },
    },
    0 // depth = 0
  );

  console.log("\n[Test 1 Result]:");
  console.log("Success:", result.success);
  console.log("Iterations:", result.iterations);
  console.log("Answer snippet:", result.answer.slice(0, 250));
  console.log("Events captured:", subAgentEvents.length);

  console.log("\n[Test 2] Testing Recursion Guardrail (depth >= 1)...");
  const blockedResult = await SubAgentExecutor.runSubAgent(
    {
      role: "coder",
      taskInstruction: "Should be blocked by depth limit",
      workspace: "default",
      userNumber: "00000",
    },
    config,
    mcpManager,
    undefined,
    1 // depth = 1 (must be blocked)
  );

  console.log("[Test 2 Result]:");
  console.log("Blocked answer:", blockedResult.answer);
  console.log("Success flag (expected false):", blockedResult.success);

  if (!blockedResult.success && blockedResult.answer.includes("maximum depth reached")) {
    console.log("\n✅ ALL MULTI-AGENT SUB-AGENT TESTS PASSED!");
  } else {
    throw new Error("Recursion guardrail test failed!");
  }

  await mcpManager.closeAll();
}

testSubAgent()
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  });
