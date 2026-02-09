import type { RequestHandler } from "express";
import { z, ZodSchema } from "zod";

interface ValidateSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export function validate(schemas: ValidateSchemas): RequestHandler {
  return (req, res, next) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        (req as any).query = schemas.query.parse(req.query);
      }
      if (schemas.params) {
        (req as any).params = schemas.params.parse(req.params);
      }
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation failed",
          errors: error.errors.map((e) => ({
            path: e.path.join("."),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  };
}
