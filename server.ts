import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Use JSON and Text body parsers
  app.use(express.json({ limit: '50mb' }));
  app.use(express.text({ limit: '50mb' }));

  const logFilePath = path.join(process.cwd(), "diagnostics_report.txt");

  // API endpoint to append logs to diagnostics_report.txt
  app.post("/api/diagnostics/append", async (req, res) => {
    try {
      const { text, snap } = req.body;
      const contentToAppend = text || "";
      
      // Append content to local file asynchronously
      await fs.promises.appendFile(logFilePath, contentToAppend + "\n", "utf8");
      
      console.log(`[Diagnostics] Appended ${contentToAppend.length} characters to external file diagnostics_report.txt`);
      res.json({ success: true, message: "Logs appended successfully.", filePath: logFilePath });
    } catch (error: any) {
      console.error("[Diagnostics Error] Failed to append logs:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API endpoint to retrieve full diagnostics file
  app.get("/api/diagnostics/read", async (req, res) => {
    try {
      if (fs.existsSync(logFilePath)) {
        const content = await fs.promises.readFile(logFilePath, "utf8");
        res.json({ success: true, content });
      } else {
        res.json({ success: true, content: "" });
      }
    } catch (error: any) {
      console.error("[Diagnostics Error] Failed to read logs:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API endpoint to clear the diagnostics log file
  app.post("/api/diagnostics/clear", async (req, res) => {
    try {
      await fs.promises.writeFile(logFilePath, "", "utf8");
      res.json({ success: true, message: "Diagnostics file cleared." });
    } catch (error: any) {
      console.error("[Diagnostics Error] Failed to clear logs:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API endpoint to download the diagnostics file directly
  app.get("/api/diagnostics/download", (req, res) => {
    try {
      if (fs.existsSync(logFilePath)) {
        res.download(logFilePath, "audio-diagnostics-report.txt");
      } else {
        res.setHeader("Content-Type", "text/plain");
        res.setHeader("Content-Disposition", "attachment; filename=audio-diagnostics-report.txt");
        res.send("No logs recorded on server yet.");
      }
    } catch (error: any) {
      console.error("[Diagnostics Error] Failed to download file:", error);
      res.status(500).send("Failed to download logs.");
    }
  });

  // API route to proxy audio files to bypass CORS restrictions
  app.get("/api/proxy-audio", async (req, res) => {
    const audioUrl = req.query.url as string;
    if (!audioUrl) {
      res.status(400).send("Parameter 'url' is required");
      return;
    }

    try {
      // Fetch audio file from the remote source
      const response = await fetch(audioUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        }
      });
      if (!response.ok) {
        res.status(response.status).send(`Failed to fetch remote audio: ${response.statusText}`);
        return;
      }

      // Relay the response headers
      const contentType = response.headers.get("content-type") || "audio/mpeg";
      const contentLength = response.headers.get("content-length");

      res.setHeader("Content-Type", contentType);
      if (contentLength) {
        res.setHeader("Content-Length", contentLength);
      }
      res.setHeader("Access-Control-Allow-Origin", "*");

      // Stream the response body
      if (response.body) {
        for await (const chunk of response.body as any) {
          res.write(chunk);
        }
        res.end();
      } else {
        const arrayBuffer = await response.arrayBuffer();
        res.send(Buffer.from(arrayBuffer));
      }
    } catch (error: any) {
      console.error("[Proxy Audio Error] Failed to fetch audio:", error);
      res.status(500).send(`Server error fetching audio: ${error.message}`);
    }
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", mode: process.env.NODE_ENV || "development" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[full-stack] Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
