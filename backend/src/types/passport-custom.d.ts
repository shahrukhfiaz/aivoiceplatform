declare module 'passport-custom' {
  import { Strategy as PassportStrategy } from 'passport';
  import { Request } from 'express';

  export class Strategy extends PassportStrategy {
    constructor(verify: (req: Request, done: (error: any, user?: any, info?: any) => void) => void);
    constructor(options: any, verify: (req: Request, done: (error: any, user?: any, info?: any) => void) => void);
    name: string;
  }
}
