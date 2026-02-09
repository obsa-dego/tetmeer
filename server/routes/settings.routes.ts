import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { blockTextureEnum, gameEngineEnum, viewModeEnum } from "@shared/schema";

export function registerSettingsRoutes(app: Express): void {
  app.get("/api/settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let profile = await storage.getProfile(userId);

      if (!profile) {
        profile = await storage.upsertProfile({ userId });
      }

      res.json({
        blockTexture: profile.blockTexture || 'default',
        backgroundColor: profile.backgroundColor || '#000000',
        gridColor: profile.gridColor || '#ffffff',
        invertX: profile.invertX ?? false,
        invertY: profile.invertY ?? false,
        mouseSensitivity: profile.mouseSensitivity ?? 50,
        wheelSensitivity: profile.wheelSensitivity ?? 50,
        gameEngine: profile.gameEngine || 'gravity',
        showPet: profile.showPet ?? false,
        selectedPets: profile.selectedPets || ['pet_puppy'],
        gridMaterial: profile.gridMaterial || 'default',
        boardMaterial: profile.boardMaterial || 'default',
        viewMode: profile.viewMode || '3d',
        equippedDecorations: profile.equippedDecorations || '{}',
        placedDecorations: profile.placedDecorations || '[]',
      });
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.patch("/api/settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { blockTexture, backgroundColor, gridColor, invertX, invertY, mouseSensitivity, wheelSensitivity, gameEngine, showPet, selectedPets, gridMaterial, boardMaterial, viewMode, equippedDecorations, placedDecorations } = req.body;

      if (blockTexture && !blockTextureEnum.includes(blockTexture)) {
        return res.status(400).json({ message: "Invalid block texture" });
      }

      if (gameEngine && !gameEngineEnum.includes(gameEngine)) {
        return res.status(400).json({ message: "Invalid game engine" });
      }

      if (viewMode && !viewModeEnum.includes(viewMode)) {
        return res.status(400).json({ message: "Invalid view mode" });
      }

      const updates: any = {};
      if (blockTexture) updates.blockTexture = blockTexture;
      if (backgroundColor) updates.backgroundColor = backgroundColor;
      if (gridColor) updates.gridColor = gridColor;
      if (typeof invertX === 'boolean') updates.invertX = invertX;
      if (typeof invertY === 'boolean') updates.invertY = invertY;
      if (typeof mouseSensitivity === 'number') updates.mouseSensitivity = Math.max(1, Math.min(100, mouseSensitivity));
      if (typeof wheelSensitivity === 'number') updates.wheelSensitivity = Math.max(1, Math.min(100, wheelSensitivity));
      if (gameEngine) updates.gameEngine = gameEngine;
      if (typeof showPet === 'boolean') updates.showPet = showPet;
      if (Array.isArray(selectedPets)) updates.selectedPets = selectedPets.slice(0, 3);
      if (gridMaterial) updates.gridMaterial = gridMaterial;
      if (boardMaterial) updates.boardMaterial = boardMaterial;
      if (viewMode) updates.viewMode = viewMode;
      if (typeof equippedDecorations === 'string') updates.equippedDecorations = equippedDecorations;
      if (typeof placedDecorations === 'string') {
        if (placedDecorations.length > 50000) {
          return res.status(400).json({ message: "Placed decorations data too large" });
        }
        try {
          const parsed = JSON.parse(placedDecorations);
          if (!Array.isArray(parsed)) {
            return res.status(400).json({ message: "Invalid placed decorations format" });
          }
          if (parsed.length > 100) {
            return res.status(400).json({ message: "Too many placed decorations (max 100)" });
          }
          for (const item of parsed) {
            if (typeof item.x !== 'number' || typeof item.z !== 'number' ||
                item.x < -50 || item.x > 50 || item.z < -50 || item.z > 50) {
              return res.status(400).json({ message: "Invalid decoration coordinates" });
            }
          }
          updates.placedDecorations = placedDecorations;
        } catch (e) {
          return res.status(400).json({ message: "Invalid placed decorations JSON" });
        }
      }

      if (Object.keys(updates).length > 0) {
        await storage.updateSettings(userId, updates);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error updating settings:", error);
      res.status(500).json({ message: "Failed to update settings" });
    }
  });
}
