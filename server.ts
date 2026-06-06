import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Endpoints
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Dynamic Google OAuth 2.0 Token Exchange Endpoint
  app.post("/api/auth/exchange", async (req, res) => {
    try {
      const { code, client_id, client_secret, redirect_uri } = req.body;
      
      if (!code || !client_id || !client_secret || !redirect_uri) {
        return res.status(400).json({ 
          success: false, 
          error: "Missing required parameters (code, client_id, client_secret, redirect_uri)" 
        });
      }

      console.log(`Exchanging code for credentials on client ID: ${client_id.substring(0, 10)}...`);

      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          code,
          client_id,
          client_secret,
          redirect_uri,
          grant_type: "authorization_code",
        }),
      });

      const data: any = await response.json();

      if (!response.ok) {
        return res.status(response.status).json({
          success: false,
          error: data.error_description || data.error || "Failed to exchange token"
        });
      }

      return res.json({
        success: true,
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
        scope: data.scope,
        token_type: data.token_type
      });
    } catch (error: any) {
      console.error("Token exchange failed:", error);
      return res.status(500).json({ 
        success: false, 
        error: error.message || "Internal server error during exchange" 
      });
    }
  });

  // Serve with Vite in development or static in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
