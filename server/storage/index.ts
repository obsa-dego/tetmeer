export type { IStorage } from "./interface";
export { DatabaseStorage } from "./database";
export { withTransaction } from "./helpers/transaction";

import { DatabaseStorage } from "./database";

export const storage = new DatabaseStorage();
