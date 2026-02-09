declare namespace Express {
  interface Request {
    user?: {
      claims: {
        sub: string;
        email?: string;
      };
    };
  }
}
