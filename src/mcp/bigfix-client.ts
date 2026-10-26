import https from "node:https";

const agent = new https.Agent({ rejectUnauthorized: false });

interface BigFixTool {
  name: string;
  description?: string;
  inputSchema: any;
}

export class BigFixStreamableHttpClient {
  private url: string;
  private token: string;
  private readOnly: boolean;
  private disableHitl: boolean;
  private sessionId: string | null = null;
  private reqId = 1;

  constructor(options: {
    url: string;
    token: string;
    readOnly?: boolean;
    disableHitl?: boolean;
  }) {
    // Ensure url ends with /mcp
    this.url = options.url.endsWith("/mcp") ? options.url : `${options.url.replace(/\/+$/, "")}/mcp`;
    this.token = options.token;
    this.readOnly = options.readOnly ?? true;
    this.disableHitl = options.disableHitl ?? false;
  }

  private async sendJsonRpc(method: string, params: any = {}): Promise<any> {
    const id = this.reqId++;
    const postData = JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params,
    });

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      "X-Bes-Mcp-Read-Only": String(this.readOnly),
      "X-Bes-Mcp-Disable-Hitl": String(this.disableHitl),
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "Content-Length": String(Buffer.byteLength(postData)),
    };

    if (this.sessionId) {
      headers["Mcp-Session-Id"] = this.sessionId;
    }

    return new Promise((resolve, reject) => {
      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort(new Error("BigFix MCP connection timed out after 30000ms"));
      }, 30000);

      const req = https.request(
        this.url,
        {
          method: "POST",
          agent,
          headers,
          signal: controller.signal,
        },
        (res) => {
          clearTimeout(timer);
          // If server provides or updates Mcp-Session-Id
          const newSessionId = res.headers["mcp-session-id"] as string;
          if (newSessionId) {
            this.sessionId = newSessionId;
          }

          let data = "";
          res.on("data", (chunk) => {
            data += chunk;
          });

          res.on("end", () => {
            if (res.statusCode && res.statusCode >= 400) {
              return reject(
                new Error(`BigFix MCP request failed with status ${res.statusCode}: ${data}`)
              );
            }

            // Streamable HTTP returns SSE lines: event: message \n data: {...}
            try {
              const lines = data.split("\n");
              const dataLine = lines.find((l) => l.startsWith("data: "));
              if (dataLine) {
                const json = JSON.parse(dataLine.slice(6));
                if (json.error) {
                  return reject(new Error(`JSON-RPC Error: ${JSON.stringify(json.error)}`));
                }
                return resolve(json.result);
              }

              // Direct JSON fallback
              const directJson = JSON.parse(data);
              if (directJson.error) {
                return reject(new Error(`JSON-RPC Error: ${JSON.stringify(directJson.error)}`));
              }
              resolve(directJson.result);
            } catch (err: any) {
              reject(new Error(`Failed to parse BigFix response: ${err.message}. Raw: ${data}`));
            }
          });
        }
      );

      req.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
      req.write(postData);
      req.end();
    });
  }

  async connect(): Promise<void> {
    const initResult = await this.sendJsonRpc("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "loop-engg-bigfix", version: "1.0.0" },
    });

    console.log(`[BigFix MCP] Connected to: ${initResult.serverInfo?.name || "BigFix Server"} (Session: ${this.sessionId})`);

    // Send notifications/initialized (notification doesn't expect response)
    try {
      await this.sendJsonRpc("notifications/initialized", {});
    } catch {
      // notifications may return empty or close
    }
  }

  async listTools(): Promise<BigFixTool[]> {
    const result = await this.sendJsonRpc("tools/list", {});
    return result?.tools || [];
  }

  async callTool(name: string, args: Record<string, any>): Promise<any> {
    const result = await this.sendJsonRpc("tools/call", {
      name,
      arguments: args,
    });
    return result;
  }
}
