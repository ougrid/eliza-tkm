// src/index.ts
import bodyParser2 from "body-parser";
import cors2 from "cors";
import express2 from "express";
import multer from "multer";
import { elizaLogger, generateCaption, generateImage } from "@ai16z/eliza";
import { composeContext } from "@ai16z/eliza";
import { generateMessageResponse } from "@ai16z/eliza";
import { messageCompletionFooter } from "@ai16z/eliza";
import {
  ModelClass
} from "@ai16z/eliza";
import { stringToUuid } from "@ai16z/eliza";
import { settings } from "@ai16z/eliza";

// src/api.ts
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { REST, Routes } from "discord.js";
function createApiRouter(agents) {
  const router = express.Router();
  router.use(cors());
  router.use(bodyParser.json());
  router.use(bodyParser.urlencoded({ extended: true }));
  router.get("/hello", (req, res) => {
    res.json({ message: "Hello World!" });
  });
  router.get("/agents", (req, res) => {
    const agentsList = Array.from(agents.values()).map((agent) => ({
      id: agent.agentId,
      name: agent.character.name
    }));
    res.json({ agents: agentsList });
  });
  router.get("/agents/:agentId", (req, res) => {
    const agentId = req.params.agentId;
    const agent = agents.get(agentId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    res.json({
      id: agent.agentId,
      character: agent.character
    });
  });
  router.get("/agents/:agentId/channels", async (req, res) => {
    const agentId = req.params.agentId;
    const runtime = agents.get(agentId);
    if (!runtime) {
      res.status(404).json({ error: "Runtime not found" });
      return;
    }
    const API_TOKEN = runtime.getSetting("DISCORD_API_TOKEN");
    const rest = new REST({ version: "10" }).setToken(API_TOKEN);
    try {
      const guilds = await rest.get(Routes.userGuilds());
      res.json({
        id: runtime.agentId,
        guilds,
        serverCount: guilds.length
      });
    } catch (error) {
      console.error("Error fetching guilds:", error);
      res.status(500).json({ error: "Failed to fetch guilds" });
    }
  });
  return router;
}

// src/index.ts
import * as fs from "fs";
import * as path from "path";
var upload = multer({ storage: multer.memoryStorage() });
var messageHandlerTemplate = (
  // {{goals}}
  `# Action Examples
{{actionExamples}}
(Action examples are for reference only. Do not use the information from them in your response.)

# Knowledge
{{knowledge}}

# Task: Generate dialog and actions for the character {{agentName}}.
About {{agentName}}:
{{bio}}
{{lore}}

{{providers}}

{{attachments}}

# Capabilities
Note that {{agentName}} is capable of reading/seeing/hearing various forms of media, including images, videos, audio, plaintext and PDFs. Recent attachments have been included above under the "Attachments" section.

{{messageDirections}}

{{recentMessages}}

{{actions}}

# Instructions: Write the next message for {{agentName}}.
` + messageCompletionFooter
);
var DirectClient = class {
  app;
  agents;
  server;
  // Store server instance
  constructor() {
    elizaLogger.log("DirectClient constructor");
    this.app = express2();
    this.app.use(cors2());
    this.agents = /* @__PURE__ */ new Map();
    this.app.use(bodyParser2.json());
    this.app.use(bodyParser2.urlencoded({ extended: true }));
    const apiRouter = createApiRouter(this.agents);
    this.app.use(apiRouter);
    this.app.post(
      "/:agentId/whisper",
      upload.single("file"),
      async (req, res) => {
        const audioFile = req.file;
        const agentId = req.params.agentId;
        if (!audioFile) {
          res.status(400).send("No audio file provided");
          return;
        }
        let runtime = this.agents.get(agentId);
        if (!runtime) {
          runtime = Array.from(this.agents.values()).find(
            (a) => a.character.name.toLowerCase() === agentId.toLowerCase()
          );
        }
        if (!runtime) {
          res.status(404).send("Agent not found");
          return;
        }
        const formData = new FormData();
        const audioBlob = new Blob([audioFile.buffer], {
          type: audioFile.mimetype
        });
        formData.append("file", audioBlob, audioFile.originalname);
        formData.append("model", "whisper-1");
        const response = await fetch(
          "https://api.openai.com/v1/audio/transcriptions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${runtime.token}`
            },
            body: formData
          }
        );
        const data = await response.json();
        res.json(data);
      }
    );
    this.app.post(
      "/:agentId/message",
      async (req, res) => {
        const agentId = req.params.agentId;
        const roomId = stringToUuid(
          req.body.roomId ?? "default-room-" + agentId
        );
        const userId = stringToUuid(req.body.userId ?? "user");
        let runtime = this.agents.get(agentId);
        if (!runtime) {
          runtime = Array.from(this.agents.values()).find(
            (a) => a.character.name.toLowerCase() === agentId.toLowerCase()
          );
        }
        if (!runtime) {
          res.status(404).send("Agent not found");
          return;
        }
        await runtime.ensureConnection(
          userId,
          roomId,
          req.body.userName,
          req.body.name,
          "direct"
        );
        const text = req.body.text;
        const messageId = stringToUuid(Date.now().toString());
        const content = {
          text,
          attachments: [],
          source: "direct",
          inReplyTo: void 0
        };
        const userMessage = {
          content,
          userId,
          roomId,
          agentId: runtime.agentId
        };
        const memory = {
          id: messageId,
          agentId: runtime.agentId,
          userId,
          roomId,
          content,
          createdAt: Date.now()
        };
        await runtime.messageManager.createMemory(memory);
        const state = await runtime.composeState(userMessage, {
          agentName: runtime.character.name
        });
        const context = composeContext({
          state,
          template: messageHandlerTemplate
        });
        const response = await generateMessageResponse({
          runtime,
          context,
          modelClass: ModelClass.SMALL
        });
        const responseMessage = {
          ...userMessage,
          userId: runtime.agentId,
          content: response
        };
        await runtime.messageManager.createMemory(responseMessage);
        if (!response) {
          res.status(500).send(
            "No response from generateMessageResponse"
          );
          return;
        }
        let message = null;
        await runtime.evaluate(memory, state);
        const _result = await runtime.processActions(
          memory,
          [responseMessage],
          state,
          async (newMessages) => {
            message = newMessages;
            return [memory];
          }
        );
        if (message) {
          res.json([response, message]);
        } else {
          res.json([response]);
        }
      }
    );
    this.app.post(
      "/:agentId/image",
      async (req, res) => {
        const agentId = req.params.agentId;
        const agent = this.agents.get(agentId);
        if (!agent) {
          res.status(404).send("Agent not found");
          return;
        }
        const images = await generateImage({ ...req.body }, agent);
        const imagesRes = [];
        if (images.data && images.data.length > 0) {
          for (let i = 0; i < images.data.length; i++) {
            const caption = await generateCaption(
              { imageUrl: images.data[i] },
              agent
            );
            imagesRes.push({
              image: images.data[i],
              caption: caption.title
            });
          }
        }
        res.json({ images: imagesRes });
      }
    );
    this.app.post(
      "/fine-tune",
      async (req, res) => {
        try {
          const response = await fetch(
            "https://api.bageldb.ai/api/v1/asset",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-API-KEY": `${process.env.BAGEL_API_KEY}`
              },
              body: JSON.stringify(req.body)
            }
          );
          const data = await response.json();
          res.json(data);
        } catch (error) {
          res.status(500).json({
            error: "Please create an account at bakery.bagel.net and get an API key. Then set the BAGEL_API_KEY environment variable.",
            details: error.message
          });
        }
      }
    );
    this.app.get(
      "/fine-tune/:assetId",
      async (req, res) => {
        const assetId = req.params.assetId;
        const downloadDir = path.join(
          process.cwd(),
          "downloads",
          assetId
        );
        console.log("Download directory:", downloadDir);
        try {
          console.log("Creating directory...");
          await fs.promises.mkdir(downloadDir, { recursive: true });
          console.log("Fetching file...");
          const fileResponse = await fetch(
            `https://api.bageldb.ai/api/v1/asset/${assetId}/download`,
            {
              headers: {
                "X-API-KEY": `${process.env.BAGEL_API_KEY}`
              }
            }
          );
          if (!fileResponse.ok) {
            throw new Error(
              `API responded with status ${fileResponse.status}: ${await fileResponse.text()}`
            );
          }
          console.log("Response headers:", fileResponse.headers);
          const fileName = fileResponse.headers.get("content-disposition")?.split("filename=")[1]?.replace(/"/g, "") || "default_name.txt";
          console.log("Saving as:", fileName);
          const arrayBuffer = await fileResponse.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const filePath = path.join(downloadDir, fileName);
          console.log("Full file path:", filePath);
          await fs.promises.writeFile(filePath, buffer);
          const stats = await fs.promises.stat(filePath);
          console.log(
            "File written successfully. Size:",
            stats.size,
            "bytes"
          );
          res.json({
            success: true,
            message: "Single file downloaded successfully",
            downloadPath: downloadDir,
            fileCount: 1,
            fileName,
            fileSize: stats.size
          });
        } catch (error) {
          console.error("Detailed error:", error);
          res.status(500).json({
            error: "Failed to download files from BagelDB",
            details: error.message,
            stack: error.stack
          });
        }
      }
    );
  }
  registerAgent(runtime) {
    this.agents.set(runtime.agentId, runtime);
  }
  unregisterAgent(runtime) {
    this.agents.delete(runtime.agentId);
  }
  start(port) {
    this.server = this.app.listen(port, () => {
      elizaLogger.success(`Server running at http://localhost:${port}/`);
    });
    const gracefulShutdown = () => {
      elizaLogger.log("Received shutdown signal, closing server...");
      this.server.close(() => {
        elizaLogger.success("Server closed successfully");
        process.exit(0);
      });
      setTimeout(() => {
        elizaLogger.error(
          "Could not close connections in time, forcefully shutting down"
        );
        process.exit(1);
      }, 5e3);
    };
    process.on("SIGTERM", gracefulShutdown);
    process.on("SIGINT", gracefulShutdown);
  }
  stop() {
    if (this.server) {
      this.server.close(() => {
        elizaLogger.success("Server stopped");
      });
    }
  }
};
var DirectClientInterface = {
  start: async (_runtime) => {
    elizaLogger.log("DirectClientInterface start");
    const client = new DirectClient();
    const serverPort = parseInt(settings.SERVER_PORT || "3000");
    client.start(serverPort);
    return client;
  },
  stop: async (_runtime, client) => {
    if (client instanceof DirectClient) {
      client.stop();
    }
  }
};
var src_default = DirectClientInterface;
export {
  DirectClient,
  DirectClientInterface,
  src_default as default,
  messageHandlerTemplate
};
//# sourceMappingURL=index.js.map